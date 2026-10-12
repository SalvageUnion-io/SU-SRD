/**
 * An entity's ROLL TABLE. Ported from component-lib's `resolveCardTable.ts`.
 */

import { SalvageUnionReference } from '../../index.js'
import type { SURefObjectTable } from '../../schemas/index.js'
import { isColumnsTable } from '../../utils/resultForTable.js'
import { tableRows } from '../../utils/tableRows.js'
import type { EntityTable } from '../types.js'

/**
 * The table a record carries: INLINE as `table`, or BY REFERENCE as a
 * `tableName` naming a `roll-tables` entry (an ability like "System and
 * Software Hacker" IS its d20 outcomes). Degrades to no table when the
 * `roll-tables` schema is not loaded.
 */
export function resolveTable(source: unknown): SURefObjectTable | undefined {
  if (source === null || typeof source !== 'object') return undefined
  if ('table' in source) {
    const table = (source as { table?: unknown }).table
    if (table !== null && typeof table === 'object') return table as SURefObjectTable
  }
  if ('tableName' in source) {
    const tableName = (source as { tableName?: unknown }).tableName
    if (typeof tableName === 'string' && tableName.length > 0) {
      if (!SalvageUnionReference.isLoaded('roll-tables')) return undefined
      return SalvageUnionReference.RollTables.getByName(tableName)?.table ?? undefined
    }
  }
  return undefined
}

/** The model's table: the record's own, else its folded self-action's. */
export function entityTable(
  entity: unknown,
  folded: unknown,
  entityName: string
): EntityTable | undefined {
  const own = resolveTable(entity)
  const table = own ?? resolveTable(folded)
  if (!table) return undefined
  const source = own ? entity : folded
  const named =
    source && typeof source === 'object' && 'tableName' in source ? source.tableName : undefined
  const name = typeof named === 'string' ? named : entityName
  return isColumnsTable(table)
    ? { kind: 'columns', name, table }
    : { kind: 'bands', name, rows: tableRows(table) }
}
