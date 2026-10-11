/**
 * The roll-table page's pure logic (board 08b): which row a roll lands on, the
 * running list of earlier rolls. Kept apart
 * from the island so it is tested without a DOM, and so the island's chunk
 * carries no ORM: `resultForTable` is the reference package's pure rules
 * helper (ADR-006), not a data read.
 */

import type { SURefObjectTable } from 'salvageunion-reference'
import { parseTraitReferences, resultForTable } from 'salvageunion-reference'

/**
 * Prose with its trait references resolved at build time: plain runs, and
 * each `[[Trait]]` as its name and (when the trait or keyword exists) its
 * page. Resolved on the server so the island reads no game data.
 */
export type RefText = (string | { ref: string; href: string | null })[]

/** Split prose on its `[[Trait]]` markup, resolving each name through `hrefFor`. */
export function refText(text: string, hrefFor: (name: string) => string | null): RefText {
  const parts: RefText = []
  let at = 0
  for (const match of parseTraitReferences(text)) {
    if (match.startIndex > at) parts.push(text.slice(at, match.startIndex))
    const ref =
      match.parameter === undefined ? match.traitName : `${match.traitName} (${match.parameter})`
    parts.push({ ref, href: hrefFor(match.traitName) })
    at = match.startIndex + match.fullMatch.length
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

/** The same prose as plain text, each reference by its name. */
export function plainText(parts: RefText): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.ref)).join('')
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
  /** The table's prose, as plain paragraphs. */
  description: string[]
  rows: RollTableRow[]
  table: SURefObjectTable
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
  const chars = rows.reduce(
    (sum, row) => sum + (row.label?.length ?? 0) + plainText(row.value).length,
    0
  )
  return rows.length >= SPLIT_ROWS || chars >= SPLIT_CHARS
}

/** How many earlier rolls the panel keeps. */
export const EARLIER_ROLLS = 5

/** A range key as the book sets it: "11-19" → "11–19" (an en dash). */
export function rangeLabel(key: string): string {
  return key.replace('-', '–')
}

/**
 * The row a roll lands on, or `undefined` when the table has no row for it (a
 * "dramatic" table prints only its 20: any other roll has no effect).
 */
export function rowForRoll(
  table: SURefObjectTable,
  rows: RollTableRow[],
  roll: number
): RollTableRow | undefined {
  const outcome = resultForTable(table, roll)
  if (!outcome.success) return undefined
  return rows.find((row) => row.key === outcome.key)
}

/**
 * What a roll reads as in the list of earlier rolls: the row's own label, else
 * "Roll N" (most tables label no rows), and "No effect" only when the table has
 * no row for the roll.
 */
export function outcomeLabel(table: SURefObjectTable, rows: RollTableRow[], roll: number): string {
  const row = rowForRoll(table, rows, roll)
  return row ? (row.label ?? `Roll ${roll}`) : 'No effect'
}

export type RollState = {
  /** The roll the table reads, or `null` before the first one. */
  roll: number | null
  /** Earlier rolls, newest first. */
  history: number[]
}

/** Record a new roll: the previous one moves to the top of the earlier rolls. */
export function recordRoll(state: RollState, roll: number): RollState {
  return {
    roll,
    history:
      state.roll === null ? state.history : [state.roll, ...state.history].slice(0, EARLIER_ROLLS),
  }
}
