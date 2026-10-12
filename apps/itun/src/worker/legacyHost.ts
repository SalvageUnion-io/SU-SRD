import { basePathOf, LEGACY_HOSTS, SITE } from '../lib/site'
import { retiredTarget } from './retiredRedirects'

/**
 * Every request that is not under the app's base (ADR-048).
 *
 * `wrangler.jsonc`'s `run_worker_first` is every path but `/build/*`, so these
 * reach the script before Static Assets looks. They come from:
 *
 * - **intheunionnow.com and its `www`**, where ITUN lived until ADR-048 and
 *   where every link already posted points. Each is a **301** to the same page
 *   under `SITE` (`https://salvageunion.io/build/…`), query kept, a retired
 *   address (`retiredRedirects.ts`) mapped to where it lives now on the way:
 *   one hop. Only the old host gets an absolute, cross-origin `Location`.
 * - **anything else**: the route's own `salvageunion.io/build` without the
 *   slash, the preview slot's and `wrangler dev`'s root. The app's root and
 *   `/build` itself 301 to `/build/`; any other path is a 404, `no-store`.
 *   ITUN serves nothing outside its base.
 *
 * None of it touches the asset binding, so none of it is a document that runs
 * script and needs `_headers`' CSP.
 */
/**
 * `wrangler.jsonc`'s `run_worker_first`, which the routing test holds equal:
 * every path but the base's. Under the base Static Assets answers first, so
 * every navigation keeps `_headers` and the CSP; outside it nothing is served
 * from the assets, and the script answers. An exclusion wins over `/*`.
 */
export const RUN_WORKER_FIRST = ['/*', `!${basePathOf(SITE.base)}/*`] as const

export function outsideBase(url: URL, base: string): Response {
  if (LEGACY_HOSTS.includes(url.hostname.toLowerCase())) {
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
