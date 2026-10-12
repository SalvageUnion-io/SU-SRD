/**
 * Where ITUN is served — refit S2 spike, `docs/spikes/s2-one-product.md`.
 *
 * Two sites, picked at BUILD time by the `ITUN_SITE` environment variable:
 *
 * - `standalone` (the default, and what production builds today): the root of
 *   intheunionnow.com.
 * - `one-domain`: `salvageunion.io/build/`, beside the SRD on one origin.
 *   Built into `dist/build/` so Static Assets finds every file under the path
 *   the browser asks for, and deployed with `wrangler deploy --env one-domain`.
 *
 * Unset, nothing changes: same base, same output, same URLs. Nothing in the
 * deploy sets it until the owner flips S2.
 *
 * `vite.config.ts` reads this; app code reads the result back through
 * `import.meta.env.BASE_URL` (`appUrl.ts`), and the Worker through its
 * `BASE_PATH` var, so neither depends on the build-time variable itself.
 */

export type ItunSite = {
  /** `ITUN_SITE`'s value for this site. */
  name: 'standalone' | 'one-domain'
  /** The public origin, without a trailing slash. */
  origin: string
  /** Vite's `base`: the path every URL the app serves starts with. */
  base: '/' | '/build/'
}

export const STANDALONE: ItunSite = {
  name: 'standalone',
  origin: 'https://intheunionnow.com',
  base: '/',
}

export const ONE_DOMAIN: ItunSite = {
  name: 'one-domain',
  origin: 'https://salvageunion.io',
  base: '/build/',
}

/** The site an `ITUN_SITE` value names. Anything else is refused, not guessed. */
export function itunSite(value: string | undefined): ItunSite {
  if (value === undefined || value === '' || value === STANDALONE.name) return STANDALONE
  if (value === ONE_DOMAIN.name) return ONE_DOMAIN
  throw new Error(`ITUN_SITE must be "${STANDALONE.name}" or "${ONE_DOMAIN.name}", not "${value}".`)
}

/**
 * A base without its trailing slash: `''` at the root, `/build` under it. The
 * prefix a root-relative route path is appended to, the Worker's `BASE_PATH`,
 * and (as `/` for the root) the router's `basepath`.
 */
export function basePathOf(base: string): string {
  return base.replace(/\/+$/, '')
}

/** The site's home page, absolute: what `og:url` and the manifest point at. */
export function siteUrl(site: ItunSite): string {
  return `${site.origin}${site.base}`
}

/**
 * `public/_headers` for a site under a base. Static Assets reads `_headers`
 * only at the asset root (`dist/`), and matches its rules against the request
 * path, so a one-domain build moves the file up out of `dist/build/` and
 * scopes its `/assets/*` rule to the base. `/*` stays as it is: the Worker is
 * routed only `/build*`, so it already means "every ITUN path".
 */
export function headersForBase(headers: string, base: string): string {
  const prefix = basePathOf(base)
  if (prefix === '') return headers
  return headers.replace(/^\/assets\/\*/m, `${prefix}/assets/*`)
}

/** The shell's sitewide `og:url` / `og:image`, re-pointed at the site's origin. */
export function shellForSite(html: string, site: ItunSite): string {
  return html.replaceAll(siteUrl(STANDALONE), siteUrl(site))
}
