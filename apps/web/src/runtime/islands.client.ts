/**
 * islands.client — the one script every page loads, beside the islands.
 *
 * Astro mounts the islands (`astro/components/Islands.astro`). This script
 * does the page's work around them: error reporting and chunk recovery, the
 * signed-in mark the account islands and Sign in read, the static chips'
 * fit, Cmd+K before a search has mounted, the wiki links, sharing, the guide
 * contents, the service worker and the offline warm. It loads no React.
 */

import { watchStaticChipFill, watchStaticTokenOverflow } from '../components/entity/staticRuntime'
import { readAccountHint } from '../lib/accountHint'
import { browserStorage, markSignedIn } from '../lib/accountState'
import { initBrowserObservability, installChunkRecovery } from '../lib/observability'
import { watchSharePage } from '../lib/sharePage'
import { registerSiteWorker } from '../lib/sw/siteWorker'
import { revealWikiLinks } from '../lib/wikiLink'
import { ISLAND_COMMIT } from './islandCommit'

// Browser error reporting to the Worker (production builds), from the single client entry.
initBrowserObservability()

// An island's chunk is the first import to fail on a page older than the
// deploy. See `installChunkRecovery` in lib/browserObservability.ts.
installChunkRecovery()

// Sign in hides while somebody is signed in (`lib/accountBar.ts`); the
// account islands read the same hint (`directives/signedIn.ts`).
markSignedIn(document, readAccountHint(browserStorage()) !== null)

// A contentful Mini's chips that do not fit beside its name go to its body's first row (C2b); an island's fit from `Mini`.
watchStaticTokenOverflow()
// A head's chips fill from its bottom-right corner (§4.7); an island's fit from `Head`, `CompactIndex`, `ChapterBand`.
watchStaticChipFill()

/** Set once a search field has mounted; its own listener then answers Cmd+K. */
let searchMounted = false
document.addEventListener(ISLAND_COMMIT, (event) => {
  if ((event.target as HTMLElement).dataset.island === 'SearchIsland') searchMounted = true
})

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
watchSharePage(document)

// A guide page served as static HTML: its contents mark the section in view.
// Plain DOM in its own chunk, fetched only on such a page; a guide card that
// is an island starts the same watcher itself (`GuideSteps`).
const guidePages = document.querySelectorAll('.su-guide--page')
if (guidePages.length > 0) {
  void import('../components/referenceEntity/card/guideContents')
    .then((m) => {
      for (const root of guidePages) m.watchGuideContents(root)
    })
    .catch((error: unknown) => {
      console.warn('[guide] could not watch the contents', error)
    })
}

// The site's one service worker, which keeps visited pages readable offline.
registerSiteWorker()

/**
 * Fill the offline page cache — but only for an installed app, and only once
 * the page the reader actually asked for has been dealt with.
 *
 * Hung off `load` rather than `DOMContentLoaded`, so a background warm of every page can never compete with first paint or with
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
