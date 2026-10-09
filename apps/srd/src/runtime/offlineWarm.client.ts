/**
 * offlineWarm — fills the page cache, but only for an **installed** app.
 *
 * ADR-034 decision 3: installing is what buys full offline, and an online
 * visitor never pre-downloads the site. `srd` is where that rule has teeth,
 * because unlike ITUN it has a genuine corpus — 1,039 pre-rendered pages —
 * and `navigateFallback: null` means an unvisited one 404s offline. Correct for
 * somebody who came to read one page; wrong for somebody who installed the app.
 *
 * ## It changes no service-worker configuration at all
 *
 * That is deliberate: the riskiest artefact in a static site is the worker
 * itself, which outlives the deploy that shipped it. This writes into the
 * **same `pages` cache** the worker's navigation rule reads from when the
 * network will not answer (`PAGES_CACHE` in `ssg/pwa.ts`; client code may not
 * import from `ssg/`, so `ssg/__tests__/pwa.test.ts` holds the two names
 * together).
 *
 * ## It refreshes every page once per deploy
 *
 * Skipping a page already cached would never refresh it: offline, an installed
 * app would read whatever build it first saw — and that copy names hashed
 * chunks the precache drops on the next deploy, so offline it would lose its
 * styles and islands too. Visiting a page heals its entry (the navigation rule
 * is network-first), but most warmed pages are never visited online.
 *
 * So the warm records which build it last completed for (`WARMED_BUILD_KEY`),
 * and on a page from a different build it re-fetches everything rather than
 * skipping what is cached. The cost is the full page set — the 3.73 MB below —
 * once per deploy, in the background, for installed apps only. Conditional
 * requests would not make it cheaper: nearly every deploy renames the hashed
 * chunks every page links to, so nearly every page really did change.
 *
 * ## Why it writes to the cache rather than just fetching
 *
 * The `pages` rule matches `request.mode === 'navigate'`. A `fetch()` from here
 * is not a navigation, so warming by fetching alone would populate nothing and
 * look like it worked. Writing through the Cache API puts entries exactly where
 * the worker looks for them.
 *
 * ## Measured cost, because the plan's gate demands a number
 *
 * 1,039 pages, **3.73 MB gzipped** (per-file, which is what HTTP actually
 * transfers — the 1.1 MB you get gzipping them as one stream is cross-file
 * dedup no browser will ever see). On top of the 2.0 MB shell precache, an
 * installed app costs roughly 5.7 MB.
 *
 * The 899 JSON endpoints are 0.70 MB and were the plan's first suggestion. They
 * are rejected: `srd` serves pre-rendered HTML and 82% of entity pages ship no
 * JavaScript on purpose, so JSON cannot render an unvisited page without adding
 * a client-side renderer — which would spend the site's whole design to save
 * 3 MB on an explicit install.
 */

/** How many pages to fetch at once. Enough to be quick, not enough to be rude. */
const CONCURRENCY = 6

/**
 * The cache the service worker's navigation rule falls back to. Must equal
 * `PAGES_CACHE` in `ssg/pwa.ts`, which `ssg/__tests__/pwa.test.ts` asserts.
 */
export const PAGES_CACHE = 'pages'

/**
 * Runs at most once per tab per build — re-checking 1,039 cache entries on every
 * navigation is waste. Holds the build it ran for, so a tab that navigates onto
 * a newer deploy warms again.
 */
const SESSION_KEY = 'su-offline-warmed'

/**
 * localStorage: the build whose pages the cache was last completely refreshed
 * with. Cache bookkeeping, not user data — losing it costs one re-download.
 */
const WARMED_BUILD_KEY = 'su-offline-warmed-build'

/**
 * The build this page came from: the deployed commit, which the deploy workflow
 * sets for every production build (it is also the Sentry release). A local or
 * CI build has none, and is treated as one build that never changes — nobody
 * keeps an installed app pointed at a local preview.
 */
const BUILD = import.meta.env.VITE_COMMIT_REF ?? 'unversioned'

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    // Storage denied (private mode, locked-down profile): read as "never ran",
    // which errs toward doing the work rather than skipping it.
    return null
  }
}

function writeStorage(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value)
  } catch {
    // Storage denied: the marker is lost, so the next run repeats work that
    // was already done. Wasteful, not wrong.
  }
}

/**
 * Is this an installed app rather than a browser tab?
 *
 * `display-mode: standalone` covers installed PWAs on every engine that
 * implements the manifest; `minimal-ui` covers the installed-but-chromed
 * variants; `navigator.standalone` is iOS Safari's older, non-standard flag,
 * kept because iOS is a realistic place to install a reference book.
 *
 * Deliberately NOT `appinstalled`: that event fires once, at the moment of
 * installation, and a user who installed last week and opened the app today
 * would never warm anything.
 */
function isInstalled(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  return (window.navigator as { standalone?: boolean }).standalone === true
}

/**
 * Every page URL, read from the sitemap the build already emits — or null when
 * the sitemap could not be read, so a failed read is never mistaken for a
 * finished warm.
 */
async function pageUrls(): Promise<string[] | null> {
  // The sitemap is the list, already generated and already correct — inventing
  // a second manifest would be a second thing to keep in step with the router.
  const res = await fetch('/sitemap-0.xml')
  if (!res.ok) return null
  const xml = await res.text()

  const urls: string[] = []
  // A regex rather than DOMParser: this runs on a page whose job is to render a
  // rulebook, and parsing a 1,000-entry document to pull one tag is more work
  // than reading it.
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const raw = match[1]
    if (raw === undefined) continue
    try {
      // Same-origin only. A sitemap is site-controlled, but writing whatever it
      // names into the cache the app serves from is not a thing to do on trust.
      const url = new URL(raw, window.location.origin)
      if (url.origin === window.location.origin) urls.push(url.pathname)
    } catch {
      // A malformed entry is skipped rather than aborting the warm.
    }
  }
  return urls
}

/**
 * Fetch and cache one page. When `refresh` is false a page already cached is
 * left alone, which is what makes a second run in the same build nearly free.
 *
 * @returns false only when the network failed, so the caller knows this build's
 *   refresh is not complete.
 */
async function warmOne(cache: Cache, path: string, refresh: boolean): Promise<boolean> {
  if (!refresh && (await cache.match(path)) !== undefined) return true

  try {
    const res = await fetch(path)
    // Only store a real page. Caching a 404 or a redirect would make the app
    // confidently serve the wrong thing offline, which is worse than serving
    // nothing. A refresh that gets one keeps the copy it already had.
    if (res.ok && res.status === 200) await cache.put(path, res.clone())
    return true
  } catch {
    // Offline mid-warm, or one page failing, must not abort the rest — but it
    // does mean this build's refresh is unfinished.
    return false
  }
}

/**
 * Warm the page cache if this is an installed app.
 *
 * Returns immediately and does no work at all in a browser tab — the guard is
 * first for that reason, so an online reader pays nothing but the function call.
 *
 * @param build this page's build; a test passes one, the app takes `BUILD`.
 */
export async function warmOfflineCacheIfInstalled(build: string = BUILD): Promise<void> {
  if (!isInstalled()) return
  if (typeof caches === 'undefined') return

  const session = () => sessionStorage
  if (readStorage(session, SESSION_KEY) === build) return
  writeStorage(session, SESSION_KEY, build)

  // A different build from the last COMPLETE warm: every cached page may name
  // chunks this build's precache no longer holds, so fetch them all again.
  const local = () => localStorage
  const refresh = readStorage(local, WARMED_BUILD_KEY) !== build

  const cache = await caches.open(PAGES_CACHE)
  const urls = await pageUrls()
  if (urls === null) return
  let complete = true

  // A fixed pool rather than `Promise.all` over 1,039 fetches: the browser would
  // queue them anyway, and a thousand in-flight requests is how a background
  // task starves the page the user is actually reading.
  let cursor = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < urls.length) {
      const index = cursor
      cursor += 1
      const path = urls[index]
      if (path !== undefined && !(await warmOne(cache, path, refresh))) complete = false
    }
  })
  await Promise.all(workers)

  // Recorded only when every page got an answer. A warm cut short by the
  // network leaves the marker on the old build, so the next tab tries again.
  if (complete) writeStorage(local, WARMED_BUILD_KEY, build)
}
