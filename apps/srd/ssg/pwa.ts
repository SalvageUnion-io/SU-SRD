/**
 * pwa — the service worker.
 *
 * Two jobs: write a tiny `registerSW.js`, and run workbox's `generateSW` over
 * the finished build.
 *
 * ## Ordering
 *
 * `generateSW` globs the **finished** `dist`, so this must run LAST — after
 * pages, endpoints and the sitemap are on disk. It also precaches
 * `registerSW.js` itself (it matches `**\/*.js`), so `registerSW.js` is written
 * first, inside this module, rather than by a caller.
 *
 * `swDest` and the emitted `workbox-*.js` runtime are excluded from the
 * precache manifest by `generateSW` itself, so a re-run over a dirty `dist`
 * does not precache the previous run's service worker.
 *
 * ## Pages: the network first, the cache only when the network will not answer
 *
 * Navigations used to be `StaleWhileRevalidate` into the `pages` cache, so a
 * returning visitor was always shown the copy from their LAST visit — one deploy
 * behind, every time — while the fresh one downloaded for next time. Worse,
 * that copy names the previous build's hashed chunks, and by the time its
 * islands asked for them the new worker had usually activated (below) and
 * dropped them from the precache, while the server no longer had them either:
 * header search and the mobile nav silently failed to mount.
 *
 * Now a navigation goes to the network, and `pages` answers only when the
 * network fails or is slower than `NAVIGATION_TIMEOUT_SECONDS`. Every
 * successful navigation still refreshes its entry, so offline reading of
 * visited pages is unchanged, and after a timeout workbox still lets the
 * network response land in the cache for next time.
 *
 * ## Why `skipWaiting` + `clientsClaim` stay — ITUN's opposite choice is right for ITUN
 *
 * A new worker takes over as soon as it installs, and activating drops every
 * precache entry the new build does not list. That is what deleted chunks under
 * ITUN's live pages, so ITUN keeps its worker waiting. Here, with HTML
 * network-first, taking over at once is the safer side:
 *
 * - **It keeps the precache on the build the pages are on.** A navigation
 *   fetches the deployed HTML, and the browser's update check on that same
 *   navigation installs the deployed worker; activating at once means the
 *   precache matches the HTML the `pages` rule just stored. A waiting worker
 *   would leave the old build's precache behind pages that name the new
 *   build's chunks — fine online, where a miss goes to the network, but
 *   broken offline.
 * - **An srd document is short-lived.** Every navigation is a full document
 *   load, so what a takeover can strand is the one page being read when it
 *   happens, not a whole session the way an ITUN tab is — and that page
 *   recovers: `installChunkRecovery` (`observability/browser`) reloads once
 *   on a failed chunk, and the reload fetches current HTML.
 * - **There is nothing to prompt with.** srd has no update UI, and none is
 *   needed when the next navigation is already current.
 *
 * What stays imperfect: a `pages` entry from an older build, when it IS served
 * (offline, or after a timeout), still names chunks the precache has dropped.
 * Visiting a page online refreshes its entry, and an installed app refreshes
 * every entry once per deploy (`src/runtime/offlineWarm.client.ts`).
 *
 * ## Deliberate non-defaults
 *
 * - `globPatterns` is js/css/woff2/svg and NOT html or images: precaching 1,039
 *   HTML pages would be a multi-megabyte install. Visited pages are covered by
 *   the `pages` runtime rule instead.
 * - `navigateFallback: null` — this is a static site, so an unvisited page
 *   should 404 offline rather than resolve to a stale shell.
 * - `sourcemap: false` is not workbox's default. Keep it, or `dist/sw.js.map`
 *   ships in the output.
 * - `cleanupOutdatedCaches: true` deletes, on activate, precaches left by OLDER
 *   WORKBOX VERSIONS (an older cache-name format). It touches neither this
 *   build's precache nor `pages` — the per-entry cleanup described above runs
 *   on every activation regardless — so it is safe whatever the update
 *   strategy, and it is what frees the storage after a workbox upgrade.
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateSW } from 'workbox-build'

/**
 * The service-worker registration snippet. `BaseLayout.tsx` loads it with
 * `<script defer src="/registerSW.js">`.
 *
 * **The `.catch()` is load-bearing.** `register()` returns a promise that
 * rejects for reasons entirely outside this site's control — a browser with
 * service workers disabled, a locked-down enterprise profile, an extension
 * intercepting the request. Unhandled, each is a rejection that Sentry's
 * `globalHandlers` integration reports as `Error: Rejected`: no stack worth
 * reading, no user impact, and nothing anyone could act on. Nine of them in a week (issue
 * SRD-2) for a feature that is meant to degrade silently.
 *
 * Swallowing is correct rather than lazy here. A failed registration means no
 * offline caching, which is a progressive enhancement this site works fine
 * without — there is no fallback to attempt and nothing to tell the user.
 *
 * Nothing downstream depends on the registration succeeding.
 */
const REGISTER_SW =
  "if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})})}"

/**
 * The runtime cache visited pages land in. `offlineWarm.client.ts` writes into
 * it under this same name — client code may not import from `ssg/`, so the
 * name is written twice and `__tests__/pwa.test.ts` holds the two together.
 */
export const PAGES_CACHE = 'pages'

/**
 * How long a navigation waits for the network before a cached copy answers.
 * Long enough that a working connection always wins (Cloudflare answers a
 * static page in well under a second), short enough that bad table wifi does
 * not hold the reader on a blank screen.
 */
export const NAVIGATION_TIMEOUT_SECONDS = 3

/** The runtime rules, exported for `__tests__/pwa.test.ts`. */
export const RUNTIME_CACHING = [
  {
    // Visited pages stay available offline (table use on bad wifi), but are
    // answered from the cache only when the network fails or times out — see
    // the header. Stringified into sw.js, so it must not reference anything
    // outside its own parameters.
    urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
    handler: 'NetworkFirst' as const,
    options: { cacheName: PAGES_CACHE, networkTimeoutSeconds: NAVIGATION_TIMEOUT_SECONDS },
  },
  {
    urlPattern: /\/schema\/.*\.json$/,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'data' },
  },
  {
    // The search island's index: 493 KB, fetched on first search interaction.
    // Uncached, search did nothing offline and re-downloaded the index on every
    // visit past its HTTP max-age. One deploy stale is fine for a search index.
    urlPattern: /\/search-index\.json$/,
    handler: 'StaleWhileRevalidate' as const,
    options: { cacheName: 'data' },
  },
]

/**
 * Write `dist/registerSW.js`, then generate `dist/sw.js` (plus its
 * `workbox-*.js` runtime chunk) over the finished `dist`.
 */
export async function writeServiceWorker(distDir: string): Promise<void> {
  await writeFile(join(distDir, 'registerSW.js'), REGISTER_SW, 'utf-8')

  const { count, size, warnings } = await generateSW({
    globDirectory: distDir,
    swDest: join(distDir, 'sw.js'),
    mode: 'production',
    sourcemap: false,
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
    // The app shell — island JS incl. the per-schema data chunks, css, fonts,
    // icons. Deliberately NOT html or images.
    globPatterns: ['**/*.{js,css,woff2,svg}'],
    navigateFallback: null,
    runtimeCaching: RUNTIME_CACHING,
  })

  for (const warning of warnings) console.warn(`[ssg] workbox: ${warning}`)
  // biome-ignore lint/suspicious/noConsole: build-time CLI — progress output is the interface
  console.log(
    `[ssg] service worker: precached ${count} file(s), ${(size / 1024 / 1024).toFixed(1)} MB`
  )
}
