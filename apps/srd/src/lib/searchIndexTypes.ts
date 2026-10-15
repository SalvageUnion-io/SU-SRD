/**
 * Shared shape between the build-time compact search index generator
 * (`searchIndexBuild.ts`, Node-only) and the client-side matcher
 * (`searchCompactIndex.ts`). Deliberately slim — no full entity data, just
 * enough to match a query and link to the entity's page — so the index
 * ships to the browser as a small static JSON asset instead of the full
 * ~1.3 MB reference corpus.
 */
import type { EntityRowModel } from 'component-lib'
import type { RefEnumSchemaName } from 'salvageunion-reference'

export type CompactSearchEntry = {
  id: string
  name: string
  slug: string
  schemaName: RefEnumSchemaName
  schemaTitle: string
  /** Lowercased, concatenated searchable text (name + description/effect/
   *  goals/assets/weaknesses/content + resolved action content). */
  text: string
  /**
   * What a search result's Row draws (entity display language, §7 "Search"):
   * the entity's model, slimmed to the Row's parts — no prose, no lead (a
   * result shows none, E11), no stat glossary — so the index stays small and
   * the browser still never loads the corpus.
   */
  model?: EntityRowModel
}
