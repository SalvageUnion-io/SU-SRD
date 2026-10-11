/**
 * The two-roll `columns` table's page logic (Callsign Table, board 08b): one
 * d20 picks the column, a second picks the entry down it. Kept apart from the
 * island, as `rollTablePage.ts` is, so it is tested without a DOM and the
 * island's chunk carries no ORM.
 */

import type { SURefObjectTable } from 'salvageunion-reference'
import { EARLIER_ROLLS } from './rollTablePage'

/** One column: its d20 range ("9-12") and its entries, by their own key. */
export type ColumnsTableColumn = {
  key: string
  entries: { key: string; value: string }[]
}

/** Everything the page and its island need, serialised once as island props. */
export type ColumnsTablePageData = {
  name: string
  /** The table's prose, as plain paragraphs. */
  description: string[]
  columns: ColumnsTableColumn[]
}

/** A pair of rolls: the column's, then the entry's. */
export type ColumnsRoll = { column: number; entry: number }

export type ColumnsRollState = {
  roll: ColumnsRoll | null
  /** The earlier rolls, newest first. */
  history: ColumnsRoll[]
}

const isEntry = (value: unknown): value is { value: string } =>
  !!value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'string'

/** A `columns` table's columns, in the book's order; empty for any other table. */
export function digestColumnsTable(table: SURefObjectTable): ColumnsTableColumn[] {
  if (table.type !== 'columns') return []
  return Object.entries(table).flatMap(([key, column]): ColumnsTableColumn[] => {
    if (key === 'type' || !column || typeof column !== 'object') return []
    const entries = Object.entries(column).flatMap(([entryKey, entry]) =>
      isEntry(entry) ? [{ key: entryKey, value: entry.value }] : []
    )
    return entries.length > 0 ? [{ key, entries }] : []
  })
}

/** Whether a range key ("9-12", "7") holds a roll. */
export function rangeHolds(key: string, roll: number): boolean {
  const [low, high = low] = key.split('-').map(Number)
  return low !== undefined && high !== undefined && roll >= low && roll <= high
}

/** Where a pair of rolls lands: its column, and the entry down it. */
export function columnsHit(
  columns: ColumnsTableColumn[],
  roll: ColumnsRoll
): { column: ColumnsTableColumn; entry: { key: string; value: string } } | undefined {
  const column = columns.find((c) => rangeHolds(c.key, roll.column))
  const entry = column?.entries.find((e) => rangeHolds(e.key, roll.entry))
  return column && entry ? { column, entry } : undefined
}

/** Record a new pair of rolls, pushing the last onto the earlier rolls. */
export function recordColumnsRoll(state: ColumnsRollState, roll: ColumnsRoll): ColumnsRollState {
  return {
    roll,
    history:
      state.roll === null ? state.history : [state.roll, ...state.history].slice(0, EARLIER_ROLLS),
  }
}
