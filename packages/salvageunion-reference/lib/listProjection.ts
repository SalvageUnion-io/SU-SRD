/**
 * List projections — the slim copy of a schema's rows that a LISTING needs.
 *
 * `actions` is the corpus's largest file, and three quarters of it is prose:
 * the paragraphs, list items and headings an action card prints when it is
 * read in full. A listing never prints them. Its rows read an action's name,
 * type, cost, range, damage, traits and choices (the folded self-action's
 * facets), plus the `datavalues` blocks those facets are drawn from, plus the
 * action's FIRST paragraph, which is the listing lead of an entity whose prose
 * lives in its actions (a First Aid Kit; `entityLead`). So the projection keeps
 * every field, every non-prose block and that one paragraph, and drops the
 * rest of the prose.
 *
 * `tools/generateRegistry.ts` writes the projection of each registry entry
 * marked `listProjection` to `lib/generated/<id>.list.generated.json`, and
 * `preload(schemas, { projection: 'list' })` loads it in place of the full
 * file. A later full `preload` replaces it. Nothing may read prose beyond the
 * first paragraph from a list-loaded schema: the reference site's listing render-equivalence test
 * (`apps/web/src/lib/__tests__/preloadEquivalence.tsx`) proves a listing
 * renders the same markup from either copy.
 *
 * This module has no imports on purpose: the generator imports it directly.
 */

/** The content-block types a card prints as prose — never read by a listing. */
const PROSE_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'list-item',
  'heading',
  'flavor',
  'hint',
])

type Compact = Record<string, unknown>

function isProseBlock(block: unknown): boolean {
  return (
    typeof block === 'object' &&
    block !== null &&
    'type' in block &&
    typeof block.type === 'string' &&
    PROSE_BLOCK_TYPES.has(block.type)
  )
}

function isParagraph(block: unknown): boolean {
  return (
    typeof block === 'object' && block !== null && 'type' in block && block.type === 'paragraph'
  )
}

/**
 * One row's list projection: the row with its prose content blocks removed,
 * all but its first paragraph (the lead). A row that carried `content` keeps
 * the key (possibly `[]`): readers fall back to the HOST entity's content when
 * a folded action has none, so dropping the key would change what they read.
 */
export function toListRow(row: Compact): Compact {
  if (!Array.isArray(row.content)) return row
  const lead = row.content.find(isParagraph)
  return {
    ...row,
    content: row.content.filter((block) => block === lead || !isProseBlock(block)),
  }
}
