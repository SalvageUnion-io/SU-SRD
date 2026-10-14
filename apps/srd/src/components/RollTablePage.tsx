/**
 * The roll-table page (board 08b): a roll table is something you roll on, so
 * its page rolls. The page module renders this inside `EntityPageFrame` in
 * place of the entity card.
 *
 * Server-only (it digests the table at build time). The island mounts the
 * same `RollTableView` live, and the server renders that view inside the
 * island's placeholder, so the bands are in the HTML for a crawler or a no-JS
 * reader and nothing moves when the island mounts. The table is the shared
 * `RollTableInstrument`, as in every card and guide; the page adds only its
 * readout.
 */

import { digestColumnsTable, digestRollTable, mentionRef } from 'component-lib'
import type { SURefEntity, SURefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary } from 'salvageunion-reference'
import type { ColumnsTablePageData } from '../lib/columnsTablePage'
import type { RollTablePageData } from '../lib/rollTablePage'
import { refText } from '../lib/rollTablePage'
import { Island } from '../runtime/Island'
import { ColumnsTableView } from './ColumnsTableView'
import { RollTableView } from './RollTableView'

/** The roll-table page's measure (board 08b): wider than an entity's. */
export const ROLL_TABLE_PAGE_MEASURE = '85rem'

/** A roll table's name, prose and table; `undefined` for any other entity. */
function rollTableParts(item: SURefEntity) {
  if (!('schemaName' in item) || item.schemaName !== 'roll-tables') return undefined
  const table =
    'table' in item && item.table && typeof item.table === 'object'
      ? (item.table as SURefObjectTable)
      : undefined
  return { name: item.name, description: extractStaticEntitySummary(item).contentParagraphs, table }
}

/**
 * The page's data for a roll table that one d20 reads, or `null` for anything
 * else: an entity that is not a roll table, and the two-roll `columns` table
 * (Callsign), which has its own page (`columnsTablePageData`).
 */
export function rollTablePageData(item: SURefEntity): RollTablePageData | null {
  const parts = rollTableParts(item)
  const table = parts?.table
  if (!parts || !table || table.type === 'columns') return null
  const rows = digestRollTable(table).map(({ key, label, value }) => ({
    key,
    label,
    value: refText(value, mentionRef),
  }))
  if (rows.length === 0) return null
  return { name: parts.name, description: parts.description, rows, table }
}

/** The page's data for a two-roll `columns` table (Callsign), or `null`. */
export function columnsTablePageData(item: SURefEntity): ColumnsTablePageData | null {
  const parts = rollTableParts(item)
  const columns = parts?.table ? digestColumnsTable(parts.table) : []
  if (!parts || columns.length === 0) return null
  return { name: parts.name, description: parts.description, columns }
}

/**
 * A two-roll table's page: the column, then the entry (Callsign Table).
 * `tone` is the page's band colour, which the table's rows band in.
 */
export function ColumnsTablePage({ data, tone }: { data: ColumnsTablePageData; tone: string }) {
  return (
    <Island name="ColumnsTableIsland" client="idle" ssr props={{ data, tone }}>
      <ColumnsTableView data={data} tone={tone} state={{ roll: null, history: [] }} />
    </Island>
  )
}

/** A banded d20 table's page; `tone` is the page's band colour, as above. */
export function RollTablePage({ data, tone }: { data: RollTablePageData; tone: string }) {
  return (
    <Island name="RollTableIsland" client="idle" ssr props={{ data, tone }}>
      <RollTableView data={data} tone={tone} state={{ roll: null, history: [] }} />
    </Island>
  )
}
