/**
 * Where the Cantina is served: `salvageunion.io/build/`, beside the SRD on one
 * origin, as its own app, Worker and deploy (ADR-048).
 *
 * The build lands in `dist/build/` so Static Assets finds every file under the
 * path the browser asks for (`vite.cantina.config.ts`). App code reads the base back
 * through `import.meta.env.BASE_URL` (`appUrl.ts`); the Worker through its
 * `BASE_PATH` var (`wrangler.jsonc`), which the routing test holds equal.
 */

export type CantinaSite = {
  /** The public origin, without a trailing slash. */
  origin: string
  /** Vite's `base`: the path every URL the app serves starts with. */
  base: string
}

export const SITE: CantinaSite = {
  origin: 'https://salvageunion.io',
  base: '/build/',
}

/**
 * A base without its trailing slash: `''` at the root, `/build` under it. The
 * prefix a root-relative route path is appended to, the Worker's `BASE_PATH`,
 * and (as `/` for the root) the router's `basepath`.
 */
export function basePathOf(base: string): string {
  return base.replace(/\/+$/, '')
}

/**
 * `public/_headers` for a site under a base. Static Assets reads `_headers`
 * only at the asset root (`dist/`), and matches its rules against the request
 * path, so the build moves the file up out of `dist/build/` and scopes its
 * `/assets/*` rule to the base. `/*` stays as it is: it already means every
 * response this Worker's assets serve.
 */
export function headersForBase(headers: string, base: string): string {
  const prefix = basePathOf(base)
  if (prefix === '') return headers
  return headers.replace(/^\/assets\/\*/m, `${prefix}/assets/*`)
}
