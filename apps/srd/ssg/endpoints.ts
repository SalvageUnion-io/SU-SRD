/**
 * endpoints — the explicit registry of non-HTML build outputs.
 *
 * The sibling of `ssg/routes.ts`: same "listed, not discovered" rule, same
 * generic-erasing `register` boundary, but the outputs are files written
 * verbatim rather than documents rendered through `BaseLayout`.
 *
 * ## Dotted patterns are FILES
 *
 * An `EndpointModule.pattern` is an output path **relative to `dist`**, not a
 * URL — `schema/[schemaId].json`, not `/schema/[schemaId].json/`. It is written
 * exactly where it says, so `/schema/chassis.json` lands at
 * `dist/schema/chassis.json` and NOT `dist/schema/chassis.json/index.html`.
 * That distinction is the whole reason `astro.config.mjs` had to set
 * `trailingSlash: 'ignore'` (read the comment there); here it falls out of the
 * pattern being a path in the first place, so there is nothing to configure.
 *
 * ## Preload ordering
 *
 * Every endpoint that reaches game data imports `getEntitySchemas` /
 * `getModel` from `src/lib/gameData`, never from `salvageunion-reference`
 * directly. Importing that module is what runs the build-time `preload('all')`,
 * and `getStaticPaths` reads models while enumerating outputs — going straight
 * to the package enumerates before any schema is loaded and the build dies on
 * "Schema not loaded".
 */

import { itemJsonEndpoint } from '../src/endpoints/itemJson'
import { llmsTxtEndpoint } from '../src/endpoints/llmsTxt'
import { schemaDefinitionJsonEndpoint } from '../src/endpoints/schemaDefinitionJson'
import { schemaJsonEndpoint } from '../src/endpoints/schemaJson'
import { searchIndexJsonEndpoint } from '../src/endpoints/searchIndexJson'
import { SITE_URL } from '../src/lib/constants'
import { fillPattern } from './render'
import type { EndpointModule, RouteContext, StaticPath } from './types'

/** One concrete output, with its module's Params/Props already erased away. */
export type ResolvedEndpoint = {
  /** Path relative to `dist`, e.g. `schema/chassis.json`. */
  outputPath: string
  contentType: string
  body: () => string
}

/** A registered endpoint module: keeps its own types, exposes only erased outputs. */
export type EndpointRegistration = {
  pattern: string
  resolve: () => ResolvedEndpoint[]
}

/**
 * Erase an endpoint module's generics at the registry boundary — the same trick
 * `register()` plays in `ssg/render.tsx`, and for the same reason: a
 * heterogeneous `EndpointModule<...>[]` cannot be typed without an `any`.
 */
export function registerEndpoint<Params extends Record<string, string>, Props>(
  module: EndpointModule<Params, Props>
): EndpointRegistration {
  return {
    pattern: module.pattern,
    resolve: () => {
      const paths: StaticPath<Params, Props>[] = module.getStaticPaths
        ? module.getStaticPaths()
        : [{ params: {} as Params, props: undefined as unknown as Props }]

      return paths.map((path) => {
        const outputPath = fillPattern(module.pattern, path.params)
        // No trailing slash: an endpoint is a file, not a directory index.
        const pathname = `/${outputPath}`
        const ctx: RouteContext<Params, Props> = {
          params: path.params,
          props: path.props,
          url: new URL(pathname, SITE_URL),
          pathname,
          // Endpoints are text outputs — nothing to point at an emitted image.
          builtAssets: {},
        }
        return {
          outputPath,
          contentType: module.contentType,
          body: () => module.body(ctx),
        }
      })
    },
  }
}

export const endpoints: EndpointRegistration[] = [
  registerEndpoint(llmsTxtEndpoint),
  registerEndpoint(searchIndexJsonEndpoint),
  registerEndpoint(schemaJsonEndpoint),
  registerEndpoint(schemaDefinitionJsonEndpoint),
  registerEndpoint(itemJsonEndpoint),
]
