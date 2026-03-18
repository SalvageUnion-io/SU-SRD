/**
 * salvageUtils.ts — pure utility functions for the post-combat salvage flow.
 *
 * NOTE: resolveRollTable extraction is expected in Story 1B (rollTableUtils.ts).
 * Once 1B merges, the local roll table lookup in resolveSalvageRoll should be
 * consolidated with that shared helper.
 * TODO: consolidate with rollTableUtils.ts once Story 1B merges.
 */
import { SalvageUnionReference, resultForTable } from 'salvageunion-reference'
import type { TableRollResult } from 'salvageunion-reference'
import { cargoRowsToGridItems, getRemainingCapacity } from './cargoGridUtils'
import type { CargoRow } from '../types/common'

export type SalvageType = 'area' | 'mech'

export type SalvageCondition = 'intact' | 'damaged' | 'destroyed'

/**
 * Returns true if the item condition permits salvage (intact or damaged only).
 * A destroyed mech cannot be salvaged.
 */
export function validateSalvageCondition(condition: SalvageCondition): boolean {
  return condition === 'intact' || condition === 'damaged'
}

/**
 * Resolves a named salvage roll table and returns the result for the given roll.
 *
 * Calls SalvageUnionReference.RollTables.find by name (as used in HeatCheckModal).
 * TODO: consolidate with rollTableUtils.ts once Story 1B merges.
 */
export function resolveSalvageRoll(
  tableSlug: 'Area Salvage' | 'Mech Salvage',
  roll: number
): TableRollResult {
  const tableEntity = SalvageUnionReference.RollTables.find((t) => t.name === tableSlug)
  if (!tableEntity || !('table' in tableEntity) || !tableEntity.table) {
    throw new Error(`Salvage roll table not found: ${tableSlug}`)
  }
  return resultForTable(tableEntity.table, roll)
}

/**
 * Computes remaining cargo space for a mech.
 *
 * Wraps getRemainingCapacity from cargoGridUtils — does NOT re-implement the logic.
 * Converts CargoRow[] to CargoGridItem[] via cargoRowsToGridItems first.
 */
export function computeCargoFit(currentCargo: CargoRow[], mechMaxCargo: number): number {
  const gridItems = cargoRowsToGridItems(currentCargo)
  return getRemainingCapacity(gridItems, mechMaxCargo)
}
