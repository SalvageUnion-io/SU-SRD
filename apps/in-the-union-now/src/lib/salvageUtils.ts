/**
 * salvageUtils.ts — pure utility functions for the post-combat salvage flow.
 */
import type { TableRollResult } from 'salvageunion-reference'
import { resolveRollTable } from './rollTableUtils'
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
 * Delegates to resolveRollTable from rollTableUtils (established in Story 1B)
 * and adapts the return type to TableRollResult for SalvageModal consumers.
 */
export function resolveSalvageRoll(
  tableSlug: 'Area Salvage' | 'Mech Salvage',
  roll: number
): TableRollResult {
  const resolved = resolveRollTable(tableSlug, roll)
  if (!resolved) {
    throw new Error(`Salvage roll table not found: ${tableSlug}`)
  }
  return { success: true, result: resolved, key: `${tableSlug}-${roll}` }
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
