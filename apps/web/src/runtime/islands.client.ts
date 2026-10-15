/**
 * islands.client — the one client entry every page loads.
 *
 * Scans `[data-island]` placeholders, resolves each one's chunk from
 * `islandRegistry`, and mounts it with `createRoot` (`mountIsland`), or with
 * `hydrateRoot` where the placeholder says `data-hydrate`.
 *
 * `createRoot` by default because `useGameData`'s server snapshot is hardcoded
 * `false` (see `ssg/DESIGN.md`), so a hydrating card would render its fallback
 * on the client's first pass while the server rendered the real thing: a
 * hydration mismatch. Client-only mounting has no mismatch class at all, because the server
 * markup is discarded rather than matched. React's first commit into the root
 * is what discards it, in the same step that inserts the island, which keeps
 * an `ssr: true` island from double-rendering without an empty frame between
 * the two. An island that reads no game data, and whose server markup is its
 * own first render, opts into `hydrate` and keeps the server's markup instead.
 *
 * An `interaction` island is not scheduled at all until the reader reaches for
 * it (`interaction.ts`), so a page nobody touches loads no React.
 */

import { browserStorage, markSignedIn } from '../lib/accountState'
import { initBrowserObservability, installChunkRecovery } from '../lib/observability'
import { revealWikiLinks } from '../lib/wikiLink'
import { readAccountHint } from '../ui/accountHint'
import { replayInteraction, watchInteraction } from './interaction'
import type { IslandComponent } from './islandRegistry'
import { islandRegistry } from './islandRegistry'
import type * as MountModule from './mountIsland'
import { mountsNow } from './mountNow'
import { schedule } from './scheduleIsland'

// Browser error reporting to the Worker (production builds), from the single client entry.
initBrowserObservability()

// Before any island is scheduled: a `load` island imports its chunk the moment
// `mountIslands` runs, and on a page older than the deploy that import is the
// first thing to fail. See `installChunkRecovery` in observability/browser.
installChunkRecovery()

// Before the islands: Sign in hides and the account islands mount only while
// somebody is signed in (`lib/accountBar.ts`).
const signedIn = readAccountHint(browserStorage()) !== null
markSignedIn(document, signedIn)

type PropsById = Record<string, Record<string, unknown>>

function readIslandProps(): PropsById {
  const script = document.querySelector('script[data-island-props]')
  if (!script?.textContent) return {}
  try {
    return JSON.parse(script.textContent) as PropsById
  } catch (error) {
    console.error('[islands] could not parse data-island-props', error)
    return {}
  }
}

function mountIslands(): void {
  const propsById = readIslandProps()

  for (const el of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const name = el.dataset.island
    if (!name) continue
    if (el.dataset.when === 'signed-in' && !signedIn) {
      // Never mounts on this load: said so, for a scan that waits on islands.
      el.dataset.islandSkipped = ''
      continue
    }
    // `name` comes off the DOM, so it is genuinely an unknown string here —
    // the compile-time `IslandName` guarantee lives at the `<Island>` call
    // site, not on this side of the serialization boundary. Narrow explicitly
    // rather than indexing a typed record with a `string`.
    const loader = Object.hasOwn(islandRegistry, name)
      ? islandRegistry[name as keyof typeof islandRegistry]
      : undefined
    if (!loader) {
      console.error(`[islands] no registry entry for "${name}"`)
      continue
    }
    const id = el.dataset.islandId ?? ''
    const props = propsById[id] ?? {}
    const directive = el.dataset.client ?? 'load'
    const hydrate = el.dataset.hydrate !== undefined

    const mount = (onCommit?: () => void) => {
      // `mountIsland` (React DOM) is fetched with the island, not imported by
      // this entry: a page whose islands never mount never loads React.
      Promise.all([loader(props), import('./mountIsland')])
        .then(([Component, { mountIsland }]: [IslandComponent | undefined, typeof MountModule]) => {
          // A failed chunk that chunk recovery is reloading for resolves to
          // `undefined`, not a rejection: its `preventDefault()` makes Vite's
          // preload helper swallow the error, and the registry's `.then` runs
          // inside that helper. The page is about to reload, so mount nothing —
          // `createElement(undefined)` throws React's "Element type is invalid"
          // before the reload lands (SRD-H).
          if (Component === undefined) return
          // No `replaceChildren()` first: the ssr:true markup stays on screen,
          // and keeps the reader's focus and input, until the island's first
          // commit replaces (or, hydrating, adopts) it (see `mountIsland`).
          mountIsland(el, Component, props, { hydrate, onCommit })
          if (name === 'SearchIsland') searchMounted = true
        })
        .catch((error: unknown) => {
          // A chunk that failed to load has already reached chunk recovery via
          // `vite:preloadError`, which reloads once; this line is what is left
          // when the reload is on cooldown, or the failure was something else.
          console.error(`[islands] failed to load "${name}"`, error)
        })
    }

    if (directive !== 'interaction') {
      schedule(directive, el, () => mount())
      continue
    }
    if (mountsNow(name, props)) {
      schedule('visible', el, () => mount())
      continue
    }
    // Mounts on the reader's first reach for it, then plays back what they did
    // while it loaded (`interaction.ts`).
    const watch = watchInteraction(el, () => mount(() => replayInteraction(el, watch.finish())), {
      trigger: el.dataset.trigger,
    })
  }
}

/** Set once a search field has mounted; its own listener then answers Cmd+K. */
let searchMounted = false

/**
 * Cmd+K / Ctrl+K before any search field has mounted: focus the server-rendered
 * field on show, which wakes its island (`interaction`), and the island's
 * mount keeps the focus. After that `SearchIsland` answers the shortcut itself.
 */
function onSearchShortcut(event: KeyboardEvent): void {
  if (searchMounted || !(event.metaKey || event.ctrlKey) || event.key !== 'k') return
  for (const input of document.querySelectorAll<HTMLInputElement>(
    '[data-island="SearchIsland"] input'
  )) {
    if (input.getClientRects().length === 0) continue
    event.preventDefault()
    input.focus()
    return
  }
}

document.addEventListener('keydown', onSearchShortcut)
revealWikiLinks(document)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIslands, { once: true })
} else {
  mountIslands()
}

// A guide page served as static HTML: its contents mark the section in view.
// Plain DOM in its own chunk, fetched only on such a page; a guide card that
// is an island starts the same watcher itself (`GuideSteps`).
const guidePages = document.querySelectorAll('.su-guide--page')
if (guidePages.length > 0) {
  void import('../ui/components/referenceEntity/card/guideContents')
    .then((m) => {
      for (const root of guidePages) m.watchGuideContents(root)
    })
    .catch((error: unknown) => {
      console.warn('[guide] could not watch the contents', error)
    })
}

/**
 * Fill the offline page cache — but only for an installed app, and only once
 * the page the reader actually asked for has been dealt with.
 *
 * Hung off `load` rather than `DOMContentLoaded`, and after island mounting, so
 * a background warm of 1,039 pages can never compete with first paint or with
 * the interactive parts of the page. In a browser tab this costs one function
 * call and a `matchMedia` check — see `offlineWarm.client.ts` for why the guard
 * is the first thing it does.
 */
function startOfflineWarm(): void {
  void import('./offlineWarm.client')
    .then((m) => m.warmOfflineCacheIfInstalled())
    .catch((error: unknown) => {
      // Offline caching is a progressive enhancement; the site reads fine
      // without it, so a failure here is logged and nothing else.
      console.warn('[offline] could not warm the page cache', error)
    })
}

if (document.readyState === 'complete') {
  startOfflineWarm()
} else {
  window.addEventListener('load', startOfflineWarm, { once: true })
}
