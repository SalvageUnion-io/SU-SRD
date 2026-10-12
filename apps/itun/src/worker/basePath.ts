/**
 * The app's base path on the Worker (refit S2 spike): `/build` in
 * `wrangler.jsonc`'s `one-domain` environment, `''` at the root. The rules in
 * `index.ts`, `retiredRedirects.ts` and `linkPreview.ts` match on the path
 * inside the app, and put the base back on every URL they build.
 *
 * `pathInApp` takes it off (`/build/p/mech/x` → `/p/mech/x`). A path outside
 * the base is left whole: nothing ITUN serves lives there, so the rules answer
 * it as the miss it is.
 */
export function pathInApp(pathname: string, base: string): string {
  if (base === '') return pathname
  if (pathname === base) return '/'
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
}
