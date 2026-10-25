/**
 * `/api/v1/…` — the Dataset API, version 1 (ADR-056).
 *
 * The same committed files `/schema/*` serves, at a versioned address with a
 * written stability promise (the `/api/` page): within v1 a change only ever
 * adds. Four kinds of file, every one a static output:
 *
 *   - `api/v1/index.json`: the manifest, every schema with its URLs, item
 *     count and a content hash, so a consumer can tell what changed without
 *     downloading it.
 *   - `api/v1/<schemaId>.json`: every entity of a schema, `data/<id>.json`
 *     verbatim.
 *   - `api/v1/<schemaId>.schema.json`: its JSON Schema, the generated file
 *     with only `$id` changed to this URL.
 *   - `api/v1/<schemaId>/<slug>.json`: one entity, as `/schema/…/item/` serves it.
 *
 * The schemas are `getEntitySchemas()`, the set every other surface publishes
 * (`schemaSurfaceParity.test.ts`), plus `actions`: data only, with no pages and
 * no per-entity files. Systems, modules, equipment and abilities name their
 * actions, and an action holds the type, cost, range, damage and traits, so
 * without it the API cannot say what a weapon does.
 */

import { createHash } from 'node:crypto'
import { API_V1_PATH, API_VERSION } from '../../lib/apiV1Paths'
import { SITE_URL } from '../../lib/constants'
import { getEntitySchemas, getSchemaCatalog } from '../../lib/gameData'
import { readReferenceFile } from '../../lib/referenceFiles'
import { getItemStaticPaths } from '../../lib/staticPaths'
import type { EndpointModule, StaticPath } from '../types'
import { committedRow } from './itemJson'

/** An absolute v1 URL for a path under the tree: `apiV1Url('chassis.json')`. */
function apiV1Url(path: string): string {
  return `${SITE_URL}${API_V1_PATH}/${path}`
}

/**
 * The generated JSON Schema with its `$id` naming the v1 URL. A text edit of
 * the one `$id` line, so the file stays byte for byte what the generator wrote
 * everywhere else.
 */
function v1SchemaBody(schemaFile: string, schemaId: string): string {
  const source = readReferenceFile(schemaFile)
  const id = JSON.stringify(apiV1Url(`${schemaId}.schema.json`))
  const rewritten = source.replace(/("\$id":\s*)"[^"]*"/, `$1${id}`)
  if (rewritten === source) throw new Error(`${schemaFile} has no $id to point at ${API_V1_PATH}`)
  return rewritten
}

/** The schemas v1 serves only as data: no page, no per-entity file. */
const DATA_ONLY_SCHEMAS = ['actions'] as const

/** Every schema v1 serves whole: the published entity schemas, then the data-only ones. */
function apiV1Schemas() {
  const dataOnly = getSchemaCatalog().schemas.filter((schema) =>
    (DATA_ONLY_SCHEMAS as readonly string[]).includes(schema.id)
  )
  return [
    ...getEntitySchemas().map((schema) => ({ ...schema, dataOnly: false })),
    ...dataOnly.map((schema) => ({ ...schema, dataOnly: true })),
  ]
}

function sha256(body: string): string {
  return createHash('sha256').update(body).digest('hex')
}

/** The manifest at `/api/v1/index.json`. */
export function apiV1Manifest() {
  return {
    api: 'SalvageUnion.io Dataset API',
    version: API_VERSION,
    docs: `${SITE_URL}/api/`,
    licence: {
      name: 'Salvage Union Open Game Licence 1.0b',
      url: 'https://leyline.press/pages/salvage-union-open-game-licence-1-0b',
      note: 'Game text and mechanics only; artwork is not covered.',
    },
    stability:
      'Within v1 changes only add: new schemas, new optional fields, new entities and corrected text. A field is never removed, renamed or retyped, and a slug that moves keeps answering at its old URL. A breaking change ships as /api/v2/, beside v1.',
    schemas: apiV1Schemas().map((schema) => ({
      id: schema.id,
      name: schema.displayNamePlural,
      description: schema.description,
      itemCount: schema.itemCount,
      sha256: sha256(readReferenceFile(schema.dataFile)),
      data: apiV1Url(`${schema.id}.json`),
      schema: apiV1Url(`${schema.id}.schema.json`),
      // A data-only schema is read whole: its rows are named by the entities that use them.
      ...(schema.dataOnly ? {} : { item: apiV1Url(`${schema.id}/{slug}.json`) }),
    })),
  }
}

export const apiV1IndexEndpoint: EndpointModule = {
  pattern: 'api/v1/index.json',
  contentType: 'application/json',
  body: () => JSON.stringify(apiV1Manifest(), null, 2),
}

type SchemaParams = { schemaId: string }

export const apiV1DataEndpoint: EndpointModule<SchemaParams, { dataFile: string }> = {
  pattern: 'api/v1/[schemaId].json',
  getStaticPaths: (): StaticPath<SchemaParams, { dataFile: string }>[] =>
    apiV1Schemas().map((schema) => ({
      params: { schemaId: schema.id },
      props: { dataFile: schema.dataFile },
    })),
  contentType: 'application/json',
  body: ({ props }) => readReferenceFile(props.dataFile),
}

export const apiV1SchemaEndpoint: EndpointModule<SchemaParams, { schemaFile: string }> = {
  pattern: 'api/v1/[schemaId].schema.json',
  getStaticPaths: (): StaticPath<SchemaParams, { schemaFile: string }>[] =>
    apiV1Schemas().map((schema) => ({
      params: { schemaId: schema.id },
      props: { schemaFile: schema.schemaFile },
    })),
  contentType: 'application/json',
  body: ({ params, props }) => v1SchemaBody(props.schemaFile, params.schemaId),
}

type ItemParams = { schemaId: string; itemId: string }
type ItemProps = ReturnType<typeof getItemStaticPaths>[number]['props']

export const apiV1ItemEndpoint: EndpointModule<ItemParams, ItemProps> = {
  pattern: 'api/v1/[schemaId]/[itemId].json',
  getStaticPaths: getItemStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => JSON.stringify(committedRow(props.item)),
}
