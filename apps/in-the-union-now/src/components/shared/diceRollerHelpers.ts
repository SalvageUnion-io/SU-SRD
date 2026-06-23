/**
 * Pure helpers for the manual d20 / stat-check reference roller (REQ-027).
 *
 * Isolated from React so they can be tested without a DOM, mirroring
 * components/pilot/rollTableHelpers.ts. These helpers are READ-ONLY: they roll a
 * die and resolve the Core Mechanic outcome band from the reference data. They
 * never touch entityStore / workspaceStore — the roller is a manual reference
 * tool and must not mutate any game state.
 */

import { roll } from '@randsum/roller'
import { SalvageUnionReference, resultForTable } from 'salvageunion-reference'
import type { SURefRollTable } from 'salvageunion-reference'

/** Name of the Core Mechanic roll table in the reference dataset. */
const CORE_MECHANIC_TABLE_NAME = 'Core Mechanic'

/**
 * Outcome of a Core Mechanic resolution.
 * - `roll` is the raw d20 (1-20).
 * - `modifier` is the flat stat/situational modifier added for a stat check.
 * - `total` is `roll + modifier`, clamped to 1-20 for band lookup (the Core
 *   Mechanic table only has bands for 1-20).
 * - `label` / `value` come from the reference data, never hardcoded UI strings.
 */
export type CoreMechanicRoll = {
  roll: number
  modifier: number
  total: number
  label: string
  value: string
}

/**
 * Dependency interface for the roller — injectable for testing.
 */
export type DiceRollerDeps = {
  findTable: (name: string) => (SURefRollTable & { schemaName: string }) | undefined
  rollD20: () => number
}

/**
 * Default production deps — read from SalvageUnionReference.
 */
const defaultDiceRollerDeps: DiceRollerDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.find((t) => t.name === name),
  rollD20: () => roll('1d20').total,
}

/** Clamps a value to the inclusive 1-20 range the Core Mechanic table covers. */
function clampToD20(value: number): number {
  if (value < 1) return 1
  if (value > 20) return 20
  return value
}

/**
 * Rolls a d20, adds a flat modifier, and resolves the Core Mechanic outcome
 * band against the reference data. Returns null if the table cannot be found or
 * the roll fails to resolve (defensive — the Core Mechanic table always exists).
 *
 * Per Core Rulebook p.232 the bands are: 20 = Nailed it, 11-19 = Success,
 * 6-10 = Tough Choice, 2-5 = Failure, 1 = Cascade Failure. The modifier (0 by
 * default for a plain d20) is added to the roll, then the total is clamped to
 * 1-20 for band lookup.
 */
export function rollCoreMechanic(
  modifier = 0,
  deps: DiceRollerDeps = defaultDiceRollerDeps
): CoreMechanicRoll | null {
  const table = deps.findTable(CORE_MECHANIC_TABLE_NAME)
  if (!table) return null

  const rolled = deps.rollD20()
  const total = clampToD20(rolled + modifier)

  const result = resultForTable(table.table, total)
  if (!result.success) return null

  return {
    roll: rolled,
    modifier,
    total,
    label: result.result.label ?? '',
    value: result.result.value,
  }
}
