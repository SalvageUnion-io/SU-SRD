/**
 * pwa — the service worker, replacing `@vite-pwa/astro`.
 *
 * `@vite-pwa/astro` did exactly two things for this site: it wrote a tiny
 * `registerSW.js` (because `injectRegister: 'script-defer'`) and it ran
 * workbox's `generateSW` over the finished build. Both are reproduced here
 * against the same configuration, which lives verbatim in `astro.config.mjs`
 * until the Astro files are deleted.
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
 * ## Deliberate non-defaults
 *
 * - `globPatterns` is js/css/woff2/svg and NOT html or images: precaching 1,039
 *   HTML pages would be a multi-megabyte install. Visited pages are covered by
 *   the `pages` runtime rule instead.
 * - `navigateFallback: null` — this is a static site, so an unvisited page
 *   should 404 offline rather than resolve to a stale shell.
 * - `sourcemap: false` and `cleanupOutdatedCaches: true` are not workbox's
 *   defaults; they are `vite-plugin-pwa`'s, and they are what the Astro
 *   baseline emitted. Keep them, or `dist/sw.js.map` appears and the parity
 *   file-set check fails.
 * - `skipWaiting` / `clientsClaim` are `registerType: 'autoUpdate'` semantics.
 *   `vite-plugin-pwa` only sets them implicitly when `injectRegister` is
 *   `'auto'`, so they were explicit there and stay explicit here.
 */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateSW } from 'workbox-build'

/**
 * Byte-for-byte what `vite-plugin-pwa` emitted for
 * `registerType: 'autoUpdate'` + `injectRegister: 'script-defer'`.
 * `BaseLayout.tsx` loads it with `<script defer src="/registerSW.js">`.
 *
 * No trailing newline: 134 bytes, byte-identical to the baseline's. That is
 * checkable — the precache entry's revision hash for `registerSW.js` must come
 * out as `1872c500de691dce40960bb85481de07`, exactly as in the baseline `sw.js`.
 */
const REGISTER_SW =
  "if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/sw.js', { scope: '/' })})}"

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
    runtimeCaching: [
      {
        // Visited pages stay available offline (table use on bad wifi).
        urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'pages' },
      },
      {
        urlPattern: /\/schema\/.*\.json$/,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'data' },
      },
    ],
  })

  for (const warning of warnings) console.warn(`[ssg] workbox: ${warning}`)
  console.log(
    `[ssg] service worker: precached ${count} file(s), ${(size / 1024 / 1024).toFixed(1)} MB`
  )
}
