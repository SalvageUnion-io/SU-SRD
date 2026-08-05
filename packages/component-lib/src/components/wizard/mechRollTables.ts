/**
 * Pure helpers for rolling on the Mech Workshop flavor tables (pp.94–95:
 * Quirks p.208, Mech Appearance p.208, Mech Pattern Names p.209).
 * Isolated from React so they can be tested without a DOM — the mech
 * counterpart of the pilot wizard's rollTableHelpers.
 */

import { roll } from '@randsum/roller'
import type { SURefRollTable } from 'salvageunion-reference'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'

/** Roll-table names for mech wizard flavor fields. */
export const MECH_ROLL_TABLE_NAMES = {
  quirk: 'Quirks',
  appearance: 'Mech Appearance',
  patternName: 'Mech Pattern Names',
} as const

export type MechRollField = keyof typeof MECH_ROLL_TABLE_NAMES

/** Dependency interface for roll table lookup — injectable for testing. */
export type MechRollTableDeps = {
  findTable: (name: string) => (SURefRollTable & { schemaName: string }) | undefined
  rollD20: () => number
}

const defaultDeps: MechRollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.getByName(name),
  rollD20: () => roll('1d20').total,
}

/**
 * Rolls a d20 and returns the result string for the given mech flavor field.
 * Returns null when the table cannot be found or the roll fails — the roll
 * is an assist, never a commitment (the result stays editable).
 */
export function rollForMechField(
  field: MechRollField,
  deps: MechRollTableDeps = defaultDeps
): string | null {
  const table = deps.findTable(MECH_ROLL_TABLE_NAMES[field])
  if (!table) return null
  const outcome = rollOnTable(table.table, deps.rollD20)
  if (!outcome.success) return null
  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
