/**
 * The app's addresses on salvageunion.io (ADR-048, ADR-062): the Training Bay
 * under {@link APP_BASE}, Play at {@link PLAY_ROOT}; every other path is the
 * reference pages'. Shared by the web app (`apps/web/src/lib/appBase.ts`), its
 * Worker and the Discord bot, so a link either builds lands in one request.
 *
 * No imports: the web app's service-worker options read it, and a reference
 * page loads those, so anything this module imported would ship to every page.
 */

/** The path every app URL starts with, without a trailing slash. */
export const APP_BASE = '/build'

/**
 * Play's root on the site: the Cantina is the app too, but its routes are
 * served at their own path, `/play/…`, beside the Training Bay's `/build/…`
 * rather than under it. The route inside the app and the path on the site are
 * the same string.
 */
export const PLAY_ROOT = '/play'

/** Whether a route inside the app is one of Play's, served at its own path. */
function isPlayRoute(route: string): boolean {
  return route === PLAY_ROOT || route.startsWith(`${PLAY_ROOT}/`)
}

/**
 * An app route as a path on the site: `appPath('/starter')` is
 * `/build/starter`, `appPath('/')` the app's front door, `/build/`, and a
 * Play route its own path (`/play/games/x`). `base` is {@link APP_BASE}, as
 * for {@link routeInApp}.
 */
export function appPath(route: string, base: string = APP_BASE): string {
  return isPlayRoute(route) ? route : `${base}${route}`
}

/**
 * The route inside the app a site path names (`/build/p/mech/x` →
 * `/p/mech/x`, `/build` → `/`, `/play/games/x` → itself), or null for a path
 * outside it. `base` is {@link APP_BASE}; a Worker test mounts the app at the
 * root with `''`.
 *
 * A Play route asked for under the base (`/build/play/…`, its old address)
 * reads as that route too; the Worker 301s it before the app ever sees it.
 */
export function routeInApp(pathname: string, base: string = APP_BASE): string | null {
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length)
  return isPlayRoute(pathname) ? pathname : null
}

/** Whether a site path is under the base, `/build` or below, rather than Play's root. */
export function underBase(pathname: string, base: string = APP_BASE): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}
