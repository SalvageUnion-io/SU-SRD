/**
 * A roll-table page's data, digested at build time for `RollTablePage` and
 * `ColumnsTablePage`: server-only, as the page is.
 */

import type { RefEntity, RefObjectTable } from 'salvageunion-reference'
import { extractStaticEntitySummary } from 'salvageunion-reference'
import { digestColumnsTable, digestRollTable, mentionRef } from '../components/index'
import type { ColumnsTablePageData } from './columnsTablePage'
import { nameRefIndexWithout } from './nameRefIndex'
import type { RollTablePageData } from './rollTablePage'
import { refText } from './rollTablePage'

/** A roll table's name, prose and table; `undefined` for any other entity. */
function rollTableParts(item: RefEntity) {
  if (!('schemaName' in item) || item.schemaName !== 'roll-tables') return undefined
  const table =
    'table' in item && item.table && typeof item.table === 'object'
      ? (item.table as RefObjectTable)
      : undefined
  // Its prose names other entries (a table's own name names itself: no link).
  const names = nameRefIndexWithout(item.id)
  const resolve = (text: string) => refText(text, mentionRef, names)
  const { contentParagraphs } = extractStaticEntitySummary(item, { keepReferences: true })
  return { name: item.name, description: contentParagraphs.map(resolve), table, resolve }
}

/**
 * The page's data for a roll table that one d20 reads, or `null` for anything
 * else: an entity that is not a roll table, and the two-roll `columns` table
 * (Callsign), which has its own page (`columnsTablePageData`).
 */
export function rollTablePageData(item: RefEntity): RollTablePageData | null {
  const parts = rollTableParts(item)
  const table = parts?.table
  if (!parts || !table || table.type === 'columns') return null
  const rows = digestRollTable(table).map(({ key, label, value }) => ({
    key,
    label,
    value: parts.resolve(value),
  }))
  if (rows.length === 0) return null
  return { name: parts.name, description: parts.description, rows, table }
}

/** The page's data for a two-roll `columns` table (Callsign), or `null`. */
export function columnsTablePageData(item: RefEntity): ColumnsTablePageData | null {
  const parts = rollTableParts(item)
  const columns = parts?.table ? digestColumnsTable(parts.table) : []
  if (!parts || columns.length === 0) return null
  return { name: parts.name, description: parts.description, columns }
}
