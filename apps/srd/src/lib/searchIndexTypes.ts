/**
 * Shared shape between the build-time compact search index generator
 * (`searchIndexBuild.ts`, Node-only) and the client-side matcher
 * (`searchCompactIndex.ts`). Deliberately slim — no full entity data, just
 * enough to match a query and link to the entity's page — so the index
 * ships to the browser as a small static JSON asset instead of the full
 * ~1.3 MB reference corpus.
 */
import type { SURefEnumSchemaName } from 'salvageunion-reference'

export type CompactSearchEntry = {
  id: string
  name: string
  slug: string
  schemaName: SURefEnumSchemaName
  schemaTitle: string
  /** Lowercased, concatenated searchable text (name + description/effect/
   *  goals/assets/weaknesses/content + resolved action content). */
  text: string
}
