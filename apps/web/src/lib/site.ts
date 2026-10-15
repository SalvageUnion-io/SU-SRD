/**
 * Where things live on salvageunion.io: the reference pages at the site's
 * root, the Cantina under its base (`appBase.ts`, ADR-048), all on one origin.
 *
 * The one home of the origin. The build reads the origin it is served from
 * once (`SITE_URL`, `constants.ts`); a page reads its own (`pageOrigin`); the
 * Worker reads the request's. No `import.meta.env` here: the Vite config, the
 * Worker and the e2e specs load this module too.
 */

import { SRD_SITE_URL } from 'salvageunion-reference'
import { appPath } from './appBase'

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
