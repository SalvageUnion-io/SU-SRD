/**
 * The app's base on salvageunion.io (ADR-048): every path under
 * {@link APP_BASE} is the app's, everything else the reference pages'.
 *
 * The one home of the base. No imports: the service worker's options
 * (`../pwa.ts`) read it, and a reference page loads those at page load
 * (`runtime/offlineWarm.client.ts`), so anything this module imported would
 * ship to every page. The origins and absolute links are `site.ts`'s.
 */

/** The path every app URL starts with, without a trailing slash. */
export const APP_BASE = '/build'

/**
 * An app route as a path on the site: `appPath('/starter')` is
 * `/build/starter`, `appPath('/')` the app's front door, `/build/`.
 */
export function appPath(route: string): string {
  return `${APP_BASE}${route}`
}

/**
 * The route inside the app a site path names (`/build/p/mech/x` →
 * `/p/mech/x`, `/build` → `/`), or null for a path outside it.
 */
export function routeInApp(pathname: string): string | null {
  if (pathname === APP_BASE) return '/'
  return pathname.startsWith(`${APP_BASE}/`) ? pathname.slice(APP_BASE.length) : null
}
