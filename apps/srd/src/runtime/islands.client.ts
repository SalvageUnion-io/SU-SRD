/**
 * islands.client — the one client entry every page loads.
 *
 * Scans `[data-island]` placeholders, resolves each one's chunk from
 * `islandRegistry`, and mounts it with **`createRoot`, never `hydrateRoot`**
 * (`mountIsland`).
 *
 * `createRoot` because `useGameData`'s server snapshot is hardcoded `false`
 * (see `ssg/DESIGN.md`), so a hydrating card would render its fallback on the
 * client's first pass while the server rendered the real thing — React #418.
 * Client-only mounting has no
 * mismatch class at all, because the server markup is discarded rather than
 * matched. React's first commit into the root is what discards it, in the same
 * step that inserts the island, which keeps an `ssr: true` island from
 * double-rendering without an empty frame between the two.
 */

import { initBrowserObservability, installChunkRecovery } from '../lib/observability'
import type { IslandComponent } from './islandRegistry'
import { islandRegistry } from './islandRegistry'
import { mountIsland } from './mountIsland'
import { schedule } from './scheduleIsland'

// Env-gated browser error tracking, initialised from the single client entry.
void initBrowserObservability()

// Before any island is scheduled: a `load` island imports its chunk the moment
// `mountIslands` runs, and on a page older than the deploy that import is the
// first thing to fail. See `installChunkRecovery` in observability/browser.
installChunkRecovery()

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

    schedule(directive, el, () => {
      loader(props)
        .then((Component: IslandComponent | undefined) => {
          // A failed chunk that chunk recovery is reloading for resolves to
          // `undefined`, not a rejection: its `preventDefault()` makes Vite's
          // preload helper swallow the error, and the registry's `.then` runs
          // inside that helper. The page is about to reload, so mount nothing —
          // `createElement(undefined)` throws React's "Element type is invalid"
          // before the reload lands (SRD-H).
          if (Component === undefined) return
          // No `replaceChildren()` first: the ssr:true markup stays on screen,
          // and keeps the reader's focus and input, until the island's first
          // commit replaces it (see `mountIsland`).
          mountIsland(el, Component, props)
        })
        .catch((error: unknown) => {
          // A chunk that failed to load has already reached chunk recovery via
          // `vite:preloadError`, which reloads once; this line is what is left
          // when the reload is on cooldown, or the failure was something else.
          console.error(`[islands] failed to load "${name}"`, error)
        })
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIslands, { once: true })
} else {
  mountIslands()
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
