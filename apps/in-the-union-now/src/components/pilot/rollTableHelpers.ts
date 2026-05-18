/**
 * Pure helpers for rolling on salvageunion-reference roll tables.
 * Isolated from React so they can be tested without a DOM.
 */

import { SalvageUnionReference, resultForTable } from 'salvageunion-reference'
import type { SURefRollTable } from 'salvageunion-reference'

/** Roll IDs for pilot wizard identity fields. */
export const PILOT_ROLL_TABLE_NAMES = {
  callsign: 'Callsign Table',
  motto: 'Motto',
  keepsake: 'Keepsake',
  appearance: 'Pilot Appearance',
  background: 'Background',
} as const

export type PilotRollField = keyof typeof PILOT_ROLL_TABLE_NAMES

/**
 * Dependency interface for roll table lookup — injectable for testing.
 */
export type RollTableDeps = {
  findTable: (name: string) => (SURefRollTable & { schemaName: string }) | undefined
  rollD20: () => number
}

/**
 * Default production deps — read from SalvageUnionReference.
 */
const defaultRollTableDeps: RollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.find((t) => t.name === name),
  rollD20: () => Math.floor(Math.random() * 20) + 1,
}

/**
 * Rolls a d20 (1–20 inclusive) and returns the result string for the given
 * pilot field. Returns null if the table cannot be found or the roll fails.
 */
export function rollForPilotField(
  field: PilotRollField,
  deps: RollTableDeps = defaultRollTableDeps
): string | null {
  const tableName = PILOT_ROLL_TABLE_NAMES[field]
  const table = deps.findTable(tableName)
  if (!table) return null

  const roll = deps.rollD20()
  const result = resultForTable(table.table, roll)
  if (!result.success) return null

  const { label, value } = result.result
  return label ? `${label}: ${value}` : value
}
