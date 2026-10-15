/**
 * Where things live on salvageunion.io: the reference pages at the site's
 * root, the Cantina under {@link APP_BASE} (ADR-048), all on one origin.
 *
 * The one home of the base and of the origin. The build reads the origin it
 * is served from once (`SITE_URL`, `constants.ts`); a page reads its own
 * (`pageOrigin`); the Worker reads the request's. No `import.meta.env` here:
 * the Vite config, the Worker and the e2e specs load this module too.
 */

import { SRD_SITE_URL } from 'salvageunion-reference'

/** The path every Cantina URL starts with, without a trailing slash. */
export const APP_BASE = '/build'

/**
 * A Cantina route as a path on the site: `appPath('/starter')` is
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

/** An origin without its trailing slash; production's when none is given. */
export function originOf(origin?: string): string {
  return (origin || SRD_SITE_URL).replace(/\/+$/, '')
}

/**
 * The origin the page was served from: production, a Worker Preview or the
 * dev server alike. Outside a page (the Worker, a script) there is none, so
 * production's.
 */
export function pageOrigin(origin = globalThis.location?.origin): string {
  return originOf(origin?.startsWith('http') ? origin : undefined)
}

/**
 * An absolute link to a Cantina route, for a link that leaves the page: copied
 * to a clipboard, drawn as a QR code, printed on a card. On the page's own
 * origin, so a link copied from a Preview opens that Preview.
 */
export function appUrl(route: string, origin: string = pageOrigin()): string {
  return `${originOf(origin)}${appPath(route)}`
}

/** The app's root, absolute: `inviteUrl` and friends append a route to it. */
export function appRoot(origin: string = pageOrigin()): string {
  return appUrl('', origin)
}
