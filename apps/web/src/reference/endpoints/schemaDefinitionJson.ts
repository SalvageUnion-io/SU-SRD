/**
 * `/schema/[schemaId].schema.json` — a schema's JSON Schema definition: the
 * generated `schemas/<id>.schema.json`, served verbatim (`readReferenceFile`).
 * Its `$id` is this URL.
 *
 * Dotted pattern: emits `dist/schema/chassis.schema.json` as a FILE. See
 * `astro/DESIGN.md`'s URL -> file table.
 */

import { getEntitySchemas } from '../../lib/gameData'
import { readReferenceFile } from '../../lib/referenceFiles'
import type { EndpointModule, StaticPath } from '../types'

type Params = { schemaId: string }
type Props = { schemaFile: string }

/**
 * `getEntitySchemas()`, not the whole catalog — the JSON surface must cover the
 * same schemas the HTML surface does. It did not: the catalog carries 27
 * schemas and only 24 get pages, so this route published
 * `/schema/actions.json` (plus catalog-categories and ability-tree-requirements)
 * for schemas with no `/<id>/` listing page to belong to. `api.page.tsx`,
 * the page that documents this API, filters them out — so those three were
 * undocumented endpoints — and the page gate (`hasPage`) read the unfiltered
 * catalog too, which is how "View in the Reference" came to link at a 404.
 *
 * The three are meta schemas: their content renders inline on the entities that
 * own it, so there is nothing for a standalone JSON Schema definition endpoint to
 * correspond to. Pinned by `schemaSurfaceParity.test.ts`.
 */
function getStaticPaths(): StaticPath<Params, Props>[] {
  return getEntitySchemas().map((schema) => ({
    params: { schemaId: schema.id },
    props: { schemaFile: schema.schemaFile },
  }))
}

export const schemaDefinitionJsonEndpoint: EndpointModule<Params, Props> = {
  pattern: 'schema/[schemaId].schema.json',
  getStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => readReferenceFile(props.schemaFile),
}
