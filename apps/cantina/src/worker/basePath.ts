/**
 * The app's base path on the Worker: `/build` in
 * `wrangler.jsonc`'s `one-domain` environment, `''` at the root. The rules in
 * `index.ts`, `retiredRedirects.ts` and `linkPreview.ts` match on the path
 * inside the app, and put the base back on every URL they build.
 *
 * `pathInApp` takes it off (`/build/p/mech/x` → `/p/mech/x`). A path outside
 * the base is left whole: nothing the Cantina serves lives there, so the rules answer
 * it as the miss it is.
 */
export function pathInApp(pathname: string, base: string): string {
  if (base === '') return pathname
  if (pathname === base) return '/'
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
}

/** Whether a path is under the base: `/build/` and below, never `/build` itself. */
export function inBase(pathname: string, base: string): boolean {
  return base === '' || pathname.startsWith(`${base}/`)
}

/**
 * A request outside the base: the bare base (`/build`) and the root 301 to
 * the base's directory, anything else is a 404, `no-store`. The Cantina
 * serves nothing outside its base, and none of it touches the asset binding.
 */
export function outsideBase(url: URL, base: string): Response {
  if (url.pathname === '/' || url.pathname === base) {
    return new Response(null, { status: 301, headers: { location: `${base}/${url.search}` } })
  }
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
}
