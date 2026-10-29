/**
 * When a new service worker takes over — imported into `sw.js` by
 * `workbox.importScripts` (`src/pwa.ts`, which says why).
 *
 * The worker is built with `registerType: 'prompt'`, so on its own a new one
 * waits until a page activates it or every tab closes. At install this decides:
 *
 * - **An app tab is open** (`/build/…` or `/play/…`): wait. The tab is a long session
 *   reading chunks the old precache holds; it moves onto the new build at its
 *   next page change, which activates this worker
 *   (`src/lib/sw/softUpdate.ts`).
 * - **None is open**: take over at once, so the precache follows the build the
 *   reference's pages are on.
 * - **The worker being replaced predates this file** (no MARKER, a Cache
 *   Storage entry every worker carrying this file writes when it activates):
 *   take over AND reload every window it controls. A legacy worker answers
 *   navigations from its precache and never checks for updates while open, so
 *   an installed app that is never closed would sit on it forever. The reload
 *   is a navigation, which this worker sends to the network.
 *
 * A first install (nothing active) never reloads: there is no old page to
 * rescue.
 *
 * Plain JS, not TypeScript: it is served from public/ as-is and runs in the
 * worker's global scope. `src/__tests__/swLifecycle.test.ts` runs it against
 * fakes.
 */
;((sw) => {
  const MARKER = 'su-sw-v1'
  // `APP_PATH` in src/pwa.ts, spelled out: this file is served as-is.
  const BUILDER = /^(\/build|\/play)(\/|$)/
  let legacy = false
  let takeover = false

  sw.addEventListener('install', (event) => {
    event.waitUntil(
      Promise.all([
        sw.caches.has(MARKER),
        sw.clients.matchAll({ type: 'window', includeUncontrolled: true }),
      ]).then(([seen, windows]) => {
        legacy = Boolean(sw.registration.active) && !seen
        const builderOpen = windows.some((client) => BUILDER.test(new URL(client.url).pathname))
        takeover = legacy || !builderOpen
        if (takeover) return sw.skipWaiting()
      })
    )
  })

  sw.addEventListener('activate', (event) => {
    const ready = sw.caches.open(MARKER).then(() => (takeover ? sw.clients.claim() : undefined))
    event.waitUntil(ready)
    if (!legacy) return
    // NOT inside waitUntil: a reload is a navigation, and navigations wait for
    // activation to finish — awaiting them here would hold activation open.
    ready
      .then(() => sw.clients.matchAll({ type: 'window' }))
      .then((windows) => {
        for (const client of windows) client.navigate(client.url).catch(() => undefined)
      })
      .catch(() => undefined)
  })
})(self)
