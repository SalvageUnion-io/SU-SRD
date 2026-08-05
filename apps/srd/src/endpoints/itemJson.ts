/**
 * `/schema/[schemaId]/item/[itemId].json` — port of
 * `src/pages/schema/[schemaId]/item/[itemId].json.ts`.
 *
 * Dotted leaf: emits `dist/schema/chassis/item/aegis.json` as a FILE, sitting
 * beside the `aegis/index.html` directory the HTML route writes.
 */

import type { EndpointModule, StaticPath } from '../../ssg/types'
import { getItemStaticPaths } from '../lib/staticPaths'

type Params = { schemaId: string; itemId: string }
type Props = ReturnType<typeof getItemStaticPaths>[number]['props']

function getStaticPaths(): StaticPath<Params, Props>[] {
  return getItemStaticPaths()
}

export const itemJsonEndpoint: EndpointModule<Params, Props> = {
  pattern: 'schema/[schemaId]/item/[itemId].json',
  getStaticPaths,
  contentType: 'application/json',
  body: ({ props }) => JSON.stringify(props.item),
}
