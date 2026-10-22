/**
 * The reference pages' registration of the site's one service worker
 * (`SITE_WORKER`, `src/pwa.ts`), called from the client entry every page loads
 * (`runtime/islands.client.ts`). The app registers the same worker through
 * `virtual:pwa-register` (`./register.ts`), which adds its update prompt; a
 * reference page needs none, because every page change is a full document load.
 *
 * At `load`, so the worker's install never competes with the page itself.
 */

import { SITE_WORKER } from '../../pwa'

/** The browser slices `registerSiteWorker` uses; tests pass stand-ins. */
type SiteWorkerHost = {
  navigator: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> }
  document: Pick<Document, 'readyState'>
  addEventListener: (type: 'load', listener: () => void, options: { once: true }) => void
}

export function registerSiteWorker(host: SiteWorkerHost = window): void {
  // Missing where the browser has none, or the page is not a secure context.
  const container = host.navigator.serviceWorker
  if (!container) return
  const register = () => {
    container.register(SITE_WORKER.url, { scope: SITE_WORKER.scope }).catch(() => {
      // Not reported: `register()` rejects for reasons outside this site's
      // control (service workers disabled, a locked-down profile, an extension
      // intercepting the request), and reporting each as `Error: Rejected`
      // is noise. Offline caching is a progressive enhancement: there is no
      // fallback to attempt and nothing to tell the reader.
    })
  }
  if (host.document.readyState === 'complete') register()
  else host.addEventListener('load', register, { once: true })
}
