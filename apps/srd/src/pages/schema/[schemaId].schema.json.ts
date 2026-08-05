import type { APIRoute } from 'astro'
import { getEntitySchemas } from 'salvageunion-reference'
import { getJsonSchemaDefinition } from 'salvageunion-reference/schema-definitions'

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
 * own it, so there is nothing for a standalone JSON Schema definition endpoint to
 * correspond to. Pinned by `schemaSurfaceParity.test.ts`.
 */
export function getStaticPaths() {
  return getEntitySchemas().map((schema) => {
    const definition = getJsonSchemaDefinition(schema.id)
    return {
      params: { schemaId: schema.id },
      props: { definition },
    }
  })
}

export const GET: APIRoute = ({ props }) => {
  return new Response(JSON.stringify(props.definition), {
    headers: { 'Content-Type': 'application/json' },
  })
}
