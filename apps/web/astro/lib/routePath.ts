import type { StaticPath } from '../../src/reference/types'

/** A route pattern filled from its params: `/[schemaId]` + `{schemaId: 'chassis'}` -> `/chassis`. */
export function fillPattern(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    const value = params[key]
    if (value === undefined) {
      throw new Error(`Missing parameter "${key}" for pattern "${pattern}"`)
    }
    return value
  })
}

/** Canonical/nav pathname: always a trailing slash. */
export function withTrailingSlash(route: string): string {
  return route.endsWith('/') ? route : `${route}/`
}

/**
 * A route's params as Astro hands them back: the ones the module's own
 * `getStaticPaths` produced, so the seam names them as the module's.
 */
export type AstroParams = Record<string, string | undefined>

/** Astro's static path for a module path: the module's props ride under `props.page`. */
type AstroPath<Params, Props> = { params: Params; props: { page: Props } }

/** A page or endpoint module's static paths, as Astro's `getStaticPaths` returns them. */
export function astroPaths<Params, Props>(
  getStaticPaths: (() => StaticPath<Params, Props>[]) | undefined
): AstroPath<Params, Props>[] {
  const paths = getStaticPaths
    ? getStaticPaths()
    : [{ params: {} as Params, props: undefined as Props }]
  return paths.map(({ params, props }) => ({ params, props: { page: props } }))
}
