/**
 * The retired builder worker. The builder once had its own service worker,
 * scoped `/build/`; the narrower scope wins, so while it stays registered it
 * answers every builder page in place of the site's one worker (`/sw.js`,
 * `src/pwa.ts`).
 *
 * A browser re-fetches a registered worker's script on navigation inside its
 * scope, finds this one, and installs it: it activates at once, deletes the
 * builder's old precache, unregisters itself and reloads its windows, which
 * the site's worker then serves. Keep it deployed: an installed app opened
 * months from now still has the old registration.
 *
 * Plain JS, served from public/ as-is. `src/__tests__/retiredBuilderSw.test.ts`
 * runs it against fakes.
 */
;((sw) => {
  sw.addEventListener('install', () => {
    sw.skipWaiting()
  })

  sw.addEventListener('activate', (event) => {
    event.waitUntil(
      sw.caches
        .keys()
        .then((names) =>
          Promise.all(
            names.filter((name) => name.includes('/build/')).map((name) => sw.caches.delete(name))
          )
        )
        .then(() => sw.registration.unregister())
        .then(() => sw.clients.matchAll({ type: 'window' }))
        .then((windows) => {
          for (const client of windows) client.navigate(client.url).catch(() => undefined)
        })
        .catch(() => undefined)
    )
  })
})(self)
