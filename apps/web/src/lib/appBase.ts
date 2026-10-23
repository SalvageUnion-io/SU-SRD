/**
 * The app's addresses on salvageunion.io (ADR-048, ADR-062), from
 * `game-domain/appAddress`, the one home of the base and Play's root, which
 * the Discord bot reads too; and the router's rewrite between them.
 *
 * No imports but that one, which has none: the service worker's options
 * (`../pwa.ts`) read it, and a reference page loads those at page load
 * (`runtime/offlineWarm.client.ts`), so anything this module imported would
 * ship to every page. The origins and absolute links are `site.ts`'s.
 */

import { appPath, routeInApp } from 'game-domain/appAddress'

export { APP_BASE, appPath, PLAY_ROOT, routeInApp, underBase } from 'game-domain/appAddress'

/**
 * The router's URL rewrite (`main.tsx`), in place of a `basepath`: a site path
 * in, its route; a route out, its path on the site.
 */
export const APP_REWRITE = {
  input: ({ url }: { url: URL }): URL | undefined => {
    const route = routeInApp(url.pathname)
    if (route === null) return undefined
    url.pathname = route
    return url
  },
  output: ({ url }: { url: URL }): URL => {
    url.pathname = appPath(url.pathname)
    return url
  },
}
