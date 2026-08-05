/**
 * `/schema/[schemaId].json` — port of `src/pages/schema/[schemaId].json.ts`.
 *
 * Dotted pattern: this emits `dist/schema/chassis.json` as a FILE, never a
 * `chassis.json/index.html` directory. See the URL -> file table in
 * `ssg/DESIGN.md` and the `trailingSlash: 'ignore'` comment in
 * `astro.config.mjs`, which exists for exactly this reason.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { getModel } from 'salvageunion-reference'
import type { EndpointModule, StaticPath } from '../../ssg/types'
// From `lib/gameData`, NOT the package: importing that module is what runs the
// build-time `preload('all')`, and `getStaticPaths` reads models during static
// generation. Pulling this straight from the package builds a route list before
// any schema is loaded and the build dies on "Schema not loaded".
import { getEntitySchemas } from '../lib/gameData'

type Params = { schemaId: string }
type Props = { data: SURefEntity[] }

/**
 * `getEntitySchemas()`, not the whole catalog — the JSON surface must cover the
 * same schemas the HTML surface does. It did not: the catalog carries 27
 * schemas and only 24 get pages, so this route published
 * `/schema/actions.json` (plus catalog-categories and ability-tree-requirements)
 * for schemas with no `/schema/<id>/` listing page to belong to. `api.astro`,
 * the page that documents this API, filters them out — so those three were
 * undocumented endpoints — and ITUN's `hasSRDPage` guard read the unfiltered
 * catalog too, which is how "View in SRD" came to link at a 404.
 *
 * The three are meta schemas: their content renders inline on the entities that
 * own it, so there is nothing for a standalone entity data endpoint to
 * correspond to. Pinned by `schemaSurfaceParity.test.ts`.
 */
function getStaticPaths(): StaticPath<Params, Props>[] {
  return getEntitySchemas().map((schema) => {
    const model = getModel(schema.id)
    const data: SURefEntity[] = model ? model.all() : []
    return {
      params: { schemaId: schema.id },
      props: { data },
    }
  })
}

export const schemaJsonEndpoint: EndpointModule<Params, Props> = {
  pattern: 'schema/[schemaId].json',
  getStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => JSON.stringify(props.data),
}
