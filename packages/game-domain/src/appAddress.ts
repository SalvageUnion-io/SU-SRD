/**
 * The app's addresses on salvageunion.io (ADR-048, ADR-062): the Training Bay
 * under {@link APP_BASE}, the Games at {@link GAMES_ROOT}; every other path is the
 * reference pages'. Shared by the web app (`apps/web/src/lib/appBase.ts`), its
 * Worker and the Discord bot, so a link either builds lands in one request.
 *
 * No imports: the web app's service-worker options read it, and a reference
 * page loads those, so anything this module imported would ship to every page.
 */

/** The path every app URL starts with, without a trailing slash. */
export const APP_BASE = '/build'

/**
 * The Games' root on the site (ADR-065): Your Games, each Game's page, its
 * Mediator's Cockpit and invites are the app too, but served at their own
 * path, `/games/…`, beside the Training Bay's `/build/…` rather than under it.
 * The route inside the app and the path on the site are the same string.
 */
export const GAMES_ROOT = '/games'

/**
 * Play's old root (ADR-062), retired by ADR-065: still the app's, so the Worker
 * runs first there and 301s each address to where it lives now.
 */
export const RETIRED_PLAY_ROOT = '/play'

/** Whether a route inside the app is served at its own root (`/games/…`, or the retired `/play/…`). */
function isRootRoute(route: string): boolean {
  return [GAMES_ROOT, RETIRED_PLAY_ROOT].some(
    (root) => route === root || route.startsWith(`${root}/`)
  )
}

/**
 * An app route as a path on the site: `appPath('/starter')` is
 * `/build/starter`, `appPath('/')` the app's front door, `/build/`, and a
 * Games route its own path (`/games/x`). `base` is {@link APP_BASE}, as
 * for {@link routeInApp}.
 */
export function appPath(route: string, base: string = APP_BASE): string {
  return isRootRoute(route) ? route : `${base}${route}`
}

/**
 * The route inside the app a site path names (`/build/p/mech/x` →
 * `/p/mech/x`, `/build` → `/`, `/games/x` → itself), or null for a path
 * outside it. `base` is {@link APP_BASE}; a Worker test mounts the app at the
 * root with `''`.
 *
 * A retired Play route (`/play/…`, or `/build/play/…`) reads as that route
 * too; the Worker 301s it before the app ever sees it.
 */
export function routeInApp(pathname: string, base: string = APP_BASE): string | null {
  if (pathname === base) return '/'
  if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length)
  return isRootRoute(pathname) ? pathname : null
}

/** Whether a site path is under the base, `/build` or below, rather than a root of its own. */
export function underBase(pathname: string, base: string = APP_BASE): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}
