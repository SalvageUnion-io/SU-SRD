import { SRD_SITE_URL } from 'salvageunion-reference'

/**
 * The SRD's origin, without a trailing slash: the page's own. The SRD and the
 * Cantina are one origin (ADR-048), in production, on a Worker Preview and on
 * the dev server alike, so nothing is configured per deployment.
 *
 * Every Cantina link into the SRD (deep links, the doc pages, the search's
 * category rows) is built on it, absolute rather than root-relative: a
 * root-relative path handed to the router (`AppLink`) would read as one of the
 * Cantina's own routes under `/build`.
 *
 * Outside a page (the Worker, a script) there is no page origin, so production's.
 */
export function srdOrigin(origin = globalThis.location?.origin): string {
  return origin?.startsWith('http') ? origin : SRD_SITE_URL.replace(/\/+$/, '')
}
