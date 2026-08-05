import type { APIRoute } from 'astro'
import { getModel } from 'salvageunion-reference'
// From `lib/gameData`, NOT the package: importing that module is what runs the
// build-time `preload('all')`, and `getStaticPaths` reads models during static
// generation. Pulling this straight from the package builds a route list before
// any schema is loaded and the build dies on "Schema not loaded".
import { getEntitySchemas } from '../../lib/gameData'

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
export function getStaticPaths() {
  return getEntitySchemas().map((schema) => {
    const model = getModel(schema.id)
    const data = model ? model.all() : []
    return {
      params: { schemaId: schema.id },
      props: { data },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
