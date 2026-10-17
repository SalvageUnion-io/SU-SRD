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
import type { FormattingOptions } from 'jsonc-parser';
export type EntityMatcher = {
    id: string;
} | {
    name: string;
};
/**
 * The entity with an `id`: an object that has none gets a fresh UUID, first in
 * key order, so a new row never needs a second tool to make it valid. Anything
 * else (an object that already has an `id`, or a non-object) comes back as is.
 */
export declare function withId(entity: unknown): unknown;
/**
 * Append a new entity to the end of a data file's top-level array,
 * preserving the formatting of every existing entity.
 *
 * @param source Full text content of the data file.
 * @param entity The entity to append (a plain JS value — object literal).
 */
export declare function addEntity(source: string, entity: unknown, formattingOptions?: FormattingOptions): string;
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
export declare function setField(source: string, matcher: EntityMatcher, field: string, value: unknown, formattingOptions?: FormattingOptions): string;
