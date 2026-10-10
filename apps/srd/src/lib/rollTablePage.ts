/**
 * The roll-table page's pure logic (board 08b): which row a roll lands on, the
 * running list of earlier rolls, and reading a typed physical roll. Kept apart
 * from the island so it is tested without a DOM, and so the island's chunk
 * carries no ORM: `resultForTable` is the reference package's pure rules
 * helper (ADR-006), not a data read.
 */

import type { SURefObjectTable } from 'salvageunion-reference'
import { resultForTable } from 'salvageunion-reference'

/** One banded row, as the page prints it. */
export type RollTableRow = {
  /** The table's own range key: "11-19", "20". */
  key: string
  /** The outcome's name, when the row names one ("Success"). */
  label: string | null
  value: string
}

/** Everything the page and its island need, serialised once as island props. */
export type RollTablePageData = {
  name: string
  /** The table's prose, as plain paragraphs. */
  description: string[]
  rows: RollTableRow[]
  table: SURefObjectTable
}

/** A d20 has twenty faces. */
export const D20_FACES = 20

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

/** A typed physical roll, if it is a whole number a d20 can show. */
export function parseTypedRoll(text: string): number | undefined {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return undefined
  const value = Number(trimmed)
  return value >= 1 && value <= D20_FACES ? value : undefined
}
