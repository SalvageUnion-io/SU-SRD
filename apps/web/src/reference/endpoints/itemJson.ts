/**
 * `/schema/[schemaId]/item/[itemId].json` — one entity's data: its committed
 * row, without the `schemaName` that `BaseModel` stamps on the model's copy
 * (the published schema forbids that key).
 *
 * Dotted leaf: emits `dist/schema/chassis/item/aegis.json` as a FILE. The API
 * keeps the `/schema/…/item/` grammar the pages left (the page is
 * `/chassis/aegis/`): its URLs are a published contract (ADR-040, ADR-043),
 * and a developer surface may say `schema`.
 */

import type { RefEntity } from 'salvageunion-reference'
import type { EndpointModule, StaticPath } from '../../../ssg/types'
import { getItemStaticPaths } from '../../lib/staticPaths'

type Params = { schemaId: string; itemId: string }
type Props = ReturnType<typeof getItemStaticPaths>[number]['props']

function committedRow(item: RefEntity): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'schemaName'))
}

/** One entity's JSON URL, root-relative: `/schema/chassis/item/aegis.json`. */
export function itemJsonPath(schemaId: string, itemId: string): string {
  return `/schema/${schemaId}/item/${itemId}.json`
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
