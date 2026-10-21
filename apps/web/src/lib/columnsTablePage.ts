/**
 * The two-roll `columns` table's page logic (Callsign Table): one
 * d20 picks the column, a second picks the entry down it. Kept apart from the
 * island, as `rollTablePage.ts` is, so it is tested without a DOM and the
 * island's chunk carries no ORM.
 */

import type { AnnouncedRoll, DigestedColumnsColumn } from '../components/index'
import type { RefText } from './rollTablePage'

/** Everything the page and its island need, serialised once as island props. */
export type ColumnsTablePageData = {
  name: string
  /** The table's prose, a paragraph each, its references resolved (`refText`). */
  description: RefText[]
  columns: DigestedColumnsColumn[]
}

/** A pair of rolls: the column's, then the entry's. */
export type ColumnsRoll = { column: number; entry: number }

/** Whether a range key ("9-12", "7") holds a roll. */
export function rangeHolds(key: string, roll: number): boolean {
  const [low, high = low] = key.split('-').map(Number)
  return low !== undefined && high !== undefined && roll >= low && roll <= high
}

/** Where a pair of rolls lands: its column, and the entry down it. */
export function columnsHit(
  columns: DigestedColumnsColumn[],
  roll: ColumnsRoll
): { column: DigestedColumnsColumn; entry: { key: string; value: string } } | undefined {
  const column = columns.find((c) => rangeHolds(c.key, roll.column))
  const entry = column?.entries.find((e) => rangeHolds(e.key, roll.entry))
  return column && entry ? { column, entry } : undefined
}

/**
 * A pair of rolls as its toast reads it (`toastRoll`): the entry's die, the
 * column it lands in, then the entry; `undefined` when the pair hits no cell.
 */
export function columnsAnnouncement(
  data: ColumnsTablePageData,
  roll: ColumnsRoll
): AnnouncedRoll | undefined {
  const hit = columnsHit(data.columns, roll)
  if (!hit) return undefined
  return {
    table: data.name,
    roll: roll.entry,
    // The book's en dash, as `rangeLabel` sets it (not imported: no ORM here).
    range: `column ${hit.column.key.replace('-', '–')}`,
    text: hit.entry.value,
  }
}
