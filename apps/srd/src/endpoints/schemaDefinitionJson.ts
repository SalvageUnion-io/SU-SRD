/**
 * `/schema/[schemaId].schema.json` — port of
 * `src/pages/schema/[schemaId].schema.json.ts`.
 *
 * Dotted pattern: emits `dist/schema/chassis.schema.json` as a FILE. See
 * `ssg/DESIGN.md`'s URL -> file table.
 */

import { getJsonSchemaDefinition } from 'salvageunion-reference/schema-definitions'
import type { EndpointModule, StaticPath } from '../../ssg/types'
// From `lib/gameData`, NOT the package — importing that module is what runs the
// build-time `preload('all')` that static generation depends on.
import { getEntitySchemas } from '../lib/gameData'

type Params = { schemaId: string }
type Props = { definition: ReturnType<typeof getJsonSchemaDefinition> }

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
function getStaticPaths(): StaticPath<Params, Props>[] {
  return getEntitySchemas().map((schema) => {
    const definition = getJsonSchemaDefinition(schema.id)
    return {
      params: { schemaId: schema.id },
      props: { definition },
    }
  })
}

export const schemaDefinitionJsonEndpoint: EndpointModule<Params, Props> = {
  pattern: 'schema/[schemaId].schema.json',
  getStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => JSON.stringify(props.definition),
}
