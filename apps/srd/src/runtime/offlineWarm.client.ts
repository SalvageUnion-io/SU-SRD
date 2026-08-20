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
 * That is deliberate, and it is why this could land while `salvageunion.io` is
 * still mid-host-move. The worker's precache list, its `navigateFallback` and
 * its runtime rules are byte-identical; this writes into the **same `pages`
 * cache** the existing `StaleWhileRevalidate` rule already reads from
 * (`ssg/pwa.ts` names it verbatim, which the built `sw.js` confirms). So the
 * riskiest artefact in a static site — the worker itself, which outlives the
 * deploy that shipped it — is untouched.
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

/** Runs at most once per tab. Re-checking 1,039 cache entries per navigation is waste. */
const SESSION_KEY = 'su-offline-warmed'

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

/** Every page URL, read from the sitemap the build already emits. */
async function pageUrls(): Promise<string[]> {
  // The sitemap is the list, already generated and already correct — inventing
  // a second manifest would be a second thing to keep in step with the router.
  const res = await fetch('/sitemap-0.xml')
  if (!res.ok) return []
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

/** Fetch and cache one page, unless it is already there. */
async function warmOne(cache: Cache, path: string): Promise<void> {
  // Skip what is already cached: this makes a re-run nearly free and, more
  // importantly, makes the whole routine idempotent without needing a build
  // version to key a "have I done this?" marker on. Pages that went stale after
  // a deploy heal on their next visit — `StaleWhileRevalidate` is already doing
  // that job and does it better than a cache-buster here would.
  const existing = await cache.match(path)
  if (existing !== undefined) return

  try {
    const res = await fetch(path)
    // Only store a real page. Caching a 404 or a redirect would make the app
    // confidently serve the wrong thing offline, which is worse than serving
    // nothing.
    if (res.ok && res.status === 200) await cache.put(path, res.clone())
  } catch {
    // Offline mid-warm, or one page failing, must not abort the rest.
  }
}

/**
 * Warm the page cache if this is an installed app.
 *
 * Returns immediately and does no work at all in a browser tab — the guard is
 * first for that reason, so an online reader pays nothing but the function call.
 */
export async function warmOfflineCacheIfInstalled(): Promise<void> {
  if (!isInstalled()) return
  if (typeof caches === 'undefined') return

  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Storage denied (private mode, locked-down profile). Warming once per
    // navigation instead of once per tab is wasteful but not wrong, so carry on.
  }

  const cache = await caches.open('pages')
  const urls = await pageUrls()

  // A fixed pool rather than `Promise.all` over 1,039 fetches: the browser would
  // queue them anyway, and a thousand in-flight requests is how a background
  // task starves the page the user is actually reading.
  let cursor = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < urls.length) {
      const index = cursor
      cursor += 1
      const path = urls[index]
      if (path !== undefined) await warmOne(cache, path)
    }
  })
  await Promise.all(workers)
}
