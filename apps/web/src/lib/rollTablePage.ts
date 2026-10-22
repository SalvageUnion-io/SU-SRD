/**
 * The roll-table page's pure logic: which row a roll lands on, the
 * running list of earlier rolls. Kept apart
 * from the island so it is tested without a DOM, and so the island's chunk
 * carries no ORM: `resultForTable` is the reference package's pure rules
 * helper (ADR-006), not a data read.
 */

import type { EntityRef, RefObjectTable } from 'salvageunion-reference'
import { NO_EFFECT, resultForTable } from 'salvageunion-reference'
import type { AnnouncedRoll } from '../components/index'
import type { ProseRefs } from './segmentProse'
import { segmentProse } from './segmentProse'

/**
 * Prose with its references resolved at build time: plain runs, and each
 * reference as the words it prints and the entry it names (`null` when it
 * names none): a `[[Trait]]`, a "p. 235" where `pageRefs` resolves it, and an
 * entry named in plain words where `nameRefs` is given. Cut by
 * `segmentProse`, as a card's prose is (`useProseRefs`), so a page links a
 * sentence as its card does. Resolved on the server so the island reads no
 * game data: a ref is a few strings, and the Mention draws its page and its
 * Peek from them.
 */
export type RefText = (string | { text: string; ref: EntityRef | null })[]

/**
 * Prose cut into `RefText`, each trait name resolved through `resolve`. A
 * paragraph break stays in the words around it.
 */
export function refText(
  text: string,
  resolve: (name: string) => EntityRef | undefined,
  refs: ProseRefs = {}
): RefText {
  const parts: RefText = []
  const words = (run: string) => {
    const last = parts.at(-1)
    if (typeof last === 'string') parts[parts.length - 1] = last + run
    else parts.push(run)
  }
  for (const segment of segmentProse(text, refs)) {
    if (segment.kind === 'text') words(segment.text)
    else if (segment.kind === 'break') words('\n\n')
    else if (segment.kind === 'trait') {
      parts.push({ text: segment.text, ref: resolve(segment.name) ?? null })
    } else parts.push({ text: segment.text, ref: segment.ref })
  }
  return parts
}

/** The same prose as plain text, each reference by its name. */
export function plainText(parts: RefText): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.text)).join('')
}

/** One banded row, as the page prints it. */
export type RollTableRow = {
  /** The table's own range key: "11-19", "20". */
  key: string
  /** The outcome's name, when the row names one ("Success"). */
  label: string | null
  /** The outcome's text, its trait references resolved (`refText`). */
  value: RefText
}

/** Everything the page and its island need, serialised once as island props. */
export type RollTablePageData = {
  name: string
  /** The table's prose, a paragraph each, its references resolved (`refText`). */
  description: RefText[]
  rows: RollTableRow[]
  table: RefObjectTable
}

/** The characters a table's bands print: every label and every outcome's text. */
function bandChars(rows: RollTableRow[]): number {
  return rows.reduce((sum, row) => sum + (row.label?.length ?? 0) + plainText(row.value).length, 0)
}

/**
 * A table this long or this wordy sets its bands in two columns on a wide
 * screen, so the page fits one screen: twenty-one bands (a d20 read one face
 * at a time), or a few bands of long text (Crawler Destruction).
 */
const SPLIT_ROWS = 10
const SPLIT_CHARS = 1400

/** Whether a table's bands split into two columns on a wide screen. */
export function splitRows(rows: RollTableRow[]): boolean {
  return rows.length >= SPLIT_ROWS || bandChars(rows) >= SPLIT_CHARS
}

/**
 * How tightly a wide screen sets the page, so the table and its panel end
 * above the fold:
 *
 * - `roomy`: a short table under a short note, set at its full size.
 * - `compact`: a split table, or bands and note that together run long
 *   (Morale's note outruns its five bands): the note in smaller type across a
 *   wider measure, the bands and the panel narrower.
 * - `dense`: bands that run long even in two columns (Mechapult, Background):
 *   each band's label runs in ahead of its text, set at the caption size
 *   (13px, above the 11px type floor), and the ranges narrower still.
 *
 * A phone sets every table alike: one list, scrolled.
 */
export type RollTableDensity = 'roomy' | 'compact' | 'dense'

const COMPACT_CHARS = 1200
const DENSE_CHARS = 1800

/** The setting a table's page takes on a wide screen, from its bands and its note. */
export function rollTableDensity(
  rows: RollTableRow[],
  description: readonly (string | RefText)[]
): RollTableDensity {
  const chars = bandChars(rows)
  if (chars >= DENSE_CHARS) return 'dense'
  const note = description.reduce(
    (sum, paragraph) =>
      sum + (typeof paragraph === 'string' ? paragraph : plainText(paragraph)).length,
    0
  )
  return splitRows(rows) || chars + note >= COMPACT_CHARS ? 'compact' : 'roomy'
}

/** A range key as the book sets it: "11-19" → "11–19" (an en dash). */
export function rangeLabel(key: string): string {
  return key.replace('-', '–')
}

/**
 * The row a roll lands on, or `undefined` when the table has no row for it (a
 * "dramatic" table prints only its 20: any other roll has no effect).
 */
export function rowForRoll(
  table: RefObjectTable,
  rows: RollTableRow[],
  roll: number
): RollTableRow | undefined {
  const outcome = resultForTable(table, roll)
  if (!outcome.success) return undefined
  return rows.find((row) => row.key === outcome.key)
}

/**
 * A roll as its toast reads it (`toastRoll`): the die, the range it lands on,
 * then the outcome's name and text. A roll with no row (a "dramatic" table
 * prints only its 20) lands on no range and reads "No effect".
 */
export function rollAnnouncement(data: RollTablePageData, roll: number): AnnouncedRoll {
  const row = rowForRoll(data.table, data.rows, roll)
  if (!row) return { table: data.name, roll, text: NO_EFFECT }
  return {
    table: data.name,
    roll,
    range: rangeLabel(row.key),
    ...(row.label ? { label: row.label } : {}),
    text: plainText(row.value),
  }
}
