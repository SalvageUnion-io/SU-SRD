/**
 * `/schema/[schemaId]/item/[itemId].json` — one entity's data: its committed
 * row, without the `schemaName` that `BaseModel` stamps on the model's copy
 * (the published schema forbids that key).
 *
 * Dotted leaf: emits `dist/schema/chassis/item/aegis.json` as a FILE, sitting
 * beside the `aegis/index.html` directory the HTML route writes.
 */

import type { SURefEntity } from 'salvageunion-reference'
import type { EndpointModule, StaticPath } from '../../ssg/types'
import { getItemStaticPaths } from '../lib/staticPaths'

type Params = { schemaId: string; itemId: string }
type Props = ReturnType<typeof getItemStaticPaths>[number]['props']

function committedRow(item: SURefEntity): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'schemaName'))
}

function getStaticPaths(): StaticPath<Params, Props>[] {
  return getItemStaticPaths()
}

export const itemJsonEndpoint: EndpointModule<Params, Props> = {
  pattern: 'schema/[schemaId]/item/[itemId].json',
  getStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => JSON.stringify(committedRow(props.item)),
}
