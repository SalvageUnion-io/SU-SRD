/**
 * render — turn one route into an HTML string.
 *
 * The same entry point is used by `ssg/build.ts` and (later) `ssg/dev.ts`, so
 * dev and prod can never diverge in what they render.
 */

import { SITE_URL } from '../src/lib/constants'
import type { BuildAssets } from './document'
import { renderDocument } from './document'
import type { PageModule, RouteContext, StaticPath } from './types'

/** One concrete page: which module renders it, and with what params/props. */
export type ResolvedRoute<Params, Props> = {
  module: PageModule<Params, Props>
  path: StaticPath<Params, Props>
  /** Route path WITHOUT a trailing slash, e.g. `/schema/chassis`. `/` stays `/`. */
  route: string
}

/** `/schema/[schemaId]` + `{schemaId: 'chassis'}` -> `/schema/chassis`. */
export function fillPattern(pattern: string, params: Record<string, string>): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    const value = params[key]
    if (value === undefined) {
      throw new Error(`Missing parameter "${key}" for pattern "${pattern}"`)
    }
    return value
  })
}

/** Canonical/nav pathname: always a trailing slash (BaseLayout.astro's rule). */
export function withTrailingSlash(route: string): string {
  return route.endsWith('/') ? route : `${route}/`
}

/**
 * Enumerate every concrete route a page module produces. A module with no
 * `getStaticPaths` is a single fixed route with empty params and props.
 */
export function resolveRoutes<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>
): ResolvedRoute<Params, Props>[] {
  const paths: StaticPath<Params, Props>[] = module.getStaticPaths
    ? module.getStaticPaths()
    : [{ params: {} as Params, props: undefined as unknown as Props }]

  return paths.map((path) => ({
    module,
    path,
    route: fillPattern(module.pattern, path.params),
  }))
}

export function renderRoute<Params extends Record<string, string>, Props>(
  resolved: ResolvedRoute<Params, Props>,
  assets: BuildAssets
): string {
  const pathname = withTrailingSlash(resolved.route)
  const ctx: RouteContext<Params, Props> = {
    params: resolved.path.params,
    props: resolved.path.props,
    url: new URL(pathname, SITE_URL),
    pathname,
  }

  const { meta, children } = resolved.module.page(ctx)
  return renderDocument({ meta, pathname, children, assets })
}

/** One concrete page, with its own Params/Props already erased away. */
export type ErasedRoute = {
  /** Route path WITHOUT a trailing slash, e.g. `/schema/chassis`. `/` stays `/`. */
  route: string
  render: (assets: BuildAssets) => string
}

/** A registered page module: still knows its own types, exposes only erased routes. */
export type RouteRegistration = {
  pattern: string
  resolve: () => ErasedRoute[]
}

/**
 * Erase a page module's generics at the registry boundary.
 *
 * A heterogeneous `PageModule<...>[]` cannot be typed without `any` (the `page`
 * callback makes `Props` contravariant), so the registry holds these instead:
 * each `register()` call keeps full inference for its own module and hands back
 * a uniform shape the builder can iterate.
 */
export function register<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>
): RouteRegistration {
  return {
    pattern: module.pattern,
    resolve: () =>
      resolveRoutes(module).map((resolved) => ({
        route: resolved.route,
        render: (assets: BuildAssets) => renderRoute(resolved, assets),
      })),
  }
}
