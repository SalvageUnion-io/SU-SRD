/**
 * The roll-table page (board 08b): a roll table is something you roll on, so
 * its page rolls. The page module renders this inside `EntityPageFrame` in
 * place of the entity card.
 *
 * Server-only (it digests the table at build time). The island mounts the
 * same `RollTableView` live, and the server renders that view inside the
 * island's placeholder, so the bands are in the HTML for a crawler or a no-JS
 * reader and nothing moves when the island mounts.
 */

import { digestRollTable } from 'component-lib'
import type { SURefEntity, SURefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary } from 'salvageunion-reference'
import type { ColumnsTablePageData } from '../lib/columnsTablePage'
import { digestColumnsTable } from '../lib/columnsTablePage'
import type { RollTablePageData } from '../lib/rollTablePage'
import { refText } from '../lib/rollTablePage'
import { resolveTraitHref } from '../lib/staticLinks'
import { Island } from '../runtime/Island'
import { ColumnsTableView } from './ColumnsTableView'
import { RollTableView } from './RollTableView'

/** The roll-table page's measure (board 08b): wider than an entity's. */
export const ROLL_TABLE_PAGE_MEASURE = '85rem'

function tableOf(item: SURefEntity): SURefObjectTable | undefined {
  return 'table' in item && item.table && typeof item.table === 'object'
    ? (item.table as SURefObjectTable)
    : undefined
}

/**
 * The page's data for a roll table that one d20 reads, or `null` for anything
 * else: an entity that is not a roll table, and the two-roll `columns` table
 * (Callsign), which has its own page (`columnsTablePageData`).
 */
export function rollTablePageData(item: SURefEntity): RollTablePageData | null {
  if (!('schemaName' in item) || item.schemaName !== 'roll-tables') return null
  const table = tableOf(item)
  if (!table || table.type === 'columns') return null
  const rows = digestRollTable(table).map(({ key, label, value }) => ({
    key,
    label,
    value: refText(value, resolveTraitHref),
  }))
  if (rows.length === 0) return null
  return {
    name: item.name,
    description: extractStaticEntitySummary(item).contentParagraphs,
    rows,
    table,
  }
}

/** The page's data for a two-roll `columns` table (Callsign), or `null`. */
export function columnsTablePageData(item: SURefEntity): ColumnsTablePageData | null {
  if (!('schemaName' in item) || item.schemaName !== 'roll-tables') return null
  const table = tableOf(item)
  const columns = table ? digestColumnsTable(table) : []
  if (columns.length === 0) return null
  return {
    name: item.name,
    description: extractStaticEntitySummary(item).contentParagraphs,
    columns,
  }
}

/** A two-roll table's page: the column, then the entry (Callsign Table). */
export function ColumnsTablePage({ data }: { data: ColumnsTablePageData }) {
  return (
    <Island name="ColumnsTableIsland" client="idle" ssr props={{ data }}>
      <ColumnsTableView data={data} state={{ roll: null, history: [] }} />
    </Island>
  )
}

export function RollTablePage({ data }: { data: RollTablePageData }) {
  return (
    <Island name="RollTableIsland" client="idle" ssr props={{ data }}>
      <RollTableView data={data} state={{ roll: null, history: [] }} />
    </Island>
  )
}
