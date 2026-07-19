/**
 * Pure helpers for rolling on salvageunion-reference roll tables.
 * Isolated from React so they can be tested without a DOM.
 */

import { roll } from '@randsum/roller'
import { SalvageUnionReference, rollOnTable } from 'salvageunion-reference'
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
  rollD20: () => roll('1d20').total,
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

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch — columns tables like the Callsign Table roll two d20s (column,
  // then entry). Shared with the Discord bot's /roll command.
  const outcome = rollOnTable(table.table, deps.rollD20)
  if (!outcome.success) return null

  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
