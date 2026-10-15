import { retiredDocPage } from '../lib/docPages'
import { LEGACY_HOSTS, SITE } from '../lib/site'
import { retiredTarget } from './retiredRedirects'

/**
 * Every request that is not under the app's base (ADR-048).
 *
 * `wrangler.jsonc`'s `run_worker_first` sends every request to the script
 * before Static Assets looks (`index.ts`). These come from:
 *
 * - **intheunionnow.com and its `www`**, where the Cantina lived until ADR-048 and
 *   where every link already posted points. Each is a **301** to the same page
 *   under `SITE` (`https://salvageunion.io/build/…`), query kept, a retired
 *   address (`retiredRedirects.ts`) mapped to where it lives now on the way:
 *   one hop. `/about` and `/changelog` go straight to the SRD's page
 *   (`docPages.ts`). Only the old host gets an absolute, cross-origin `Location`.
 * - **anything else**: the route's own `salvageunion.io/build` without the
 *   slash, a Worker Preview's and `wrangler dev`'s root. The app's root and
 *   `/build` itself 301 to `/build/`; any other path is a 404, `no-store`.
 *   The Cantina serves nothing outside its base.
 *
 * None of it touches the asset binding, so none of it is a document that runs
 * script and needs `_headers`' CSP.
 */
/**
 * `wrangler.jsonc`'s `run_worker_first`, which the routing test holds equal:
 * every request, so a missing file under the base reaches `index.ts` and is a
 * 404 rather than the shell. Not a pattern list: a request matching a negative
 * pattern goes straight to the assets, and a list answers every other miss
 * with the shell too — `["/*", "!/build/*"]` served `/build/assets/*` misses
 * that way (`index.ts`). Under the base the script reads each answer through
 * the asset binding, which applies `_headers` and the CSP.
 */
export const RUN_WORKER_FIRST = true

export function outsideBase(url: URL, base: string): Response {
  if (LEGACY_HOSTS.includes(url.hostname.toLowerCase())) {
    const docPage = retiredDocPage(url.pathname)
    if (docPage !== null) return redirect(docPage)
    const path = retiredTarget(url.pathname) ?? url.pathname
    return redirect(`${SITE.origin}${base}${path}${url.search}`)
  }
  if (url.pathname === '/' || url.pathname === base) return redirect(`${base}/${url.search}`)
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
}

/** Whether a path is under the base: `/build/` and below, never `/build` itself. */
export function inBase(pathname: string, base: string): boolean {
  return base === '' || pathname.startsWith(`${base}/`)
}

function redirect(location: string): Response {
  return new Response(null, { status: 301, headers: { location } })
}
