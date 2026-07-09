/**
 * Formatting-preserving edits for `data/*.json`.
 *
 * CLAUDE.md's Data Conventions warn: "When modifying JSON data files
 * (especially crawler output), never use automated formatters like
 * `json.dump` that reformat arrays. Use text-level insertion to preserve
 * original formatting." — because `JSON.stringify(data, null, 2)` reformats
 * the ~1.3MB hand-formatted `data/*.json` corpus wholesale (differing
 * quoting/spacing choices, key order, etc. all get flattened to one style),
 * turning a one-field diff into a file-wide diff.
 *
 * This module uses `jsonc-parser`'s `modify`/`applyEdits` — a CST-level
 * (concrete syntax tree) editor that computes the minimal text edit for a
 * single change and leaves every other byte of the file untouched. See
 * tools/editData.test.ts for the byte-identical-outside-the-edit proof.
 *
 * Only two operations are supported, matching the two workarounds CLAUDE.md
 * calls out: appending a new entity to a data file's top-level array, and
 * updating a single field on an existing entity. Both are pure string ->
 * string transforms so they're trivially testable without touching disk.
 */

import { modify, applyEdits, parse as parseJsonc, type FormattingOptions } from 'jsonc-parser'

/** Matches the repo's existing data-file style: 2-space indent, LF line endings. */
export const DEFAULT_FORMATTING: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
}

export type EntityMatcher = { id: string } | { name: string }

function findEntityIndex(entities: unknown[], matcher: EntityMatcher): number {
  return entities.findIndex((e) => {
    if (e === null || typeof e !== 'object') return false
    const record = e as Record<string, unknown>
    if ('id' in matcher) return record.id === matcher.id
    return record.name === matcher.name
  })
}

/**
 * Append a new entity to the end of a data file's top-level array,
 * preserving the formatting of every existing entity.
 *
 * @param source Full text content of the data file.
 * @param entity The entity to append (a plain JS value — object literal).
 */
export function addEntity(
  source: string,
  entity: unknown,
  formattingOptions: FormattingOptions = DEFAULT_FORMATTING
): string {
  const parsed = parseJsonc(source) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('addEntity: the data file does not contain a top-level JSON array')
  }

  const edits = modify(source, [parsed.length], entity, {
    isArrayInsertion: true,
    formattingOptions,
  })
  return applyEdits(source, edits)
}

/**
 * Update a single field on one existing entity (matched by `id` or `name`),
 * preserving the formatting of every other entity and every other field on
 * the matched entity.
 *
 * @param source Full text content of the data file.
 * @param matcher `{ id }` or `{ name }` identifying which entity to edit.
 * @param field The field name to set (top-level field on the matched entity).
 * @param value The new value for that field.
 */
export function setField(
  source: string,
  matcher: EntityMatcher,
  field: string,
  value: unknown,
  formattingOptions: FormattingOptions = DEFAULT_FORMATTING
): string {
  const parsed = parseJsonc(source) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('setField: the data file does not contain a top-level JSON array')
  }

  const index = findEntityIndex(parsed, matcher)
  if (index === -1) {
    const desc = 'id' in matcher ? `id "${matcher.id}"` : `name "${matcher.name}"`
    throw new Error(`setField: no entity found with ${desc}`)
  }

  const edits = modify(source, [index, field], value, { formattingOptions })
  return applyEdits(source, edits)
}
