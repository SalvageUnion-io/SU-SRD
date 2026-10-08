/**
 * One-time takeover from a legacy service worker — imported into `sw.js` by
 * `workbox.importScripts` (src/lib/sw/workbox.ts).
 *
 * `registerType: 'prompt'` keeps a new worker WAITING until the user accepts the
 * update toast or every tab closes. That is right between two current builds,
 * but it strands the tabs that predate #1026: their worker answers every
 * navigation from its precache (a reload boots the old build again), their
 * pages never check for updates while open, and the oldest have no toast to
 * accept at all. An installed PWA that is never closed sits there forever.
 *
 * So when the worker being replaced predates this file, this one does not wait:
 * it activates at once, takes control, and reloads every window it controls.
 * The reload is a navigation, which this worker sends to the network
 * (`workbox.ts`), so each tab boots the deployed build. Deleting the old
 * precache under a live page is what `prompt` exists to prevent; reloading the
 * page in the same breath is what makes it safe here.
 *
 * "Predates this file" is the absence of MARKER, a Cache Storage entry every
 * worker carrying this file writes when it activates. After that, later deploys
 * find it and take the normal prompt path. A first install (nothing active)
 * never takes over — there is no old page to rescue.
 *
 * Plain JS, not TypeScript: it is served from public/ as-is and runs in the
 * worker's global scope. __tests__/swTakeover.test.ts runs it against fakes.
 */
;((sw) => {
  const MARKER = 'itun-sw-takeover-v1'
  let takeover = false

  sw.addEventListener('install', (event) => {
    event.waitUntil(
      sw.caches.has(MARKER).then((seen) => {
        takeover = Boolean(sw.registration.active) && !seen
        if (takeover) return sw.skipWaiting()
      })
    )
  })

  sw.addEventListener('activate', (event) => {
    const ready = sw.caches.open(MARKER).then(() => (takeover ? sw.clients.claim() : undefined))
    event.waitUntil(ready)
    if (!takeover) return
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
