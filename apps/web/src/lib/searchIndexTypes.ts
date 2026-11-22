/**
 * Shared shape between the build-time compact search index generator
 * (`searchIndexBuild.ts`, Node-only) and the client-side matcher
 * (`searchCompactIndex.ts`). Deliberately slim — no full entity data, just
 * enough to match a query and link to the entity's page — so the index
 * ships to the browser as a small static JSON asset instead of the full
 * ~1.3 MB reference corpus.
 */

import type { RefEnumSchemaName } from 'salvageunion-reference'
import type { EntityFormModel } from '../components/index'

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
   * What a search result's Compact draws (entity display language, §7 "Search"):
   * the entity's model, slimmed to the Compact's parts — no prose, no lead (a
   * result shows none, E11; a keyword's or trait's first sentence alone, the
   * dropdown's line under its name, L5), no stat glossary — so the index stays small and
   * the browser still never loads the corpus.
   */
  model?: EntityFormModel
  /**
   * The name as a reader may type it instead (`searchAliases`): a stat's
   * abbreviation, a table's famous result. Lowered; also in `text`.
   */
  aliases?: string[]
  /**
   * A PATTERN's row: it has no schema of its own, so `schemaName` is its
   * host's and these say what it is ("Pattern · Mule": pattern names repeat
   * between chassis) and where its page is.
   */
  pattern?: { href: string; kind: string }
  /**
   * The row is a RULE told inside a guide (Training Points), not a pattern:
   * it carries its own page and kind the same way (`pattern`), and ranks as
   * the rules' own kinds do.
   */
  rule?: true
  /**
   * A ROLL TABLE printed inside another entry (an ability's, a System's):
   * ranked under that owner (`scoreSearchMatch`'s `embedded`).
   */
  embedded?: true
}
