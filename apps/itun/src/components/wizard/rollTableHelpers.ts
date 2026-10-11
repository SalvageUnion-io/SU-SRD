/**
 * Pure helpers for rolling on salvageunion-reference roll tables.
 * Isolated from React so they can be tested without a DOM.
 */

import type { SURefRollTable } from 'salvageunion-reference'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { rollDie } from 'salvageunion-reference/rules'

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
  findTable: (name) => SalvageUnionReference.RollTables.getByName(name),
  rollD20: () => rollDie(20),
}

/**
 * Rolls a d20 (1–20 inclusive) and returns the result string for the given
 * pilot field. Returns null if the table cannot be found or the roll fails.
 */
export function rollForPilotField(
  field: PilotRollField,
  deps: RollTableDeps = defaultRollTableDeps
): string | null {
  return rollOnNamedTable(PILOT_ROLL_TABLE_NAMES[field], deps)
}

/**
 * Rolls on any roll table by its name — the one a choice's data points at
 * (`source.rollTable`, e.g. the Augmented crawler's "A.I. Personality"), so a
 * Roll appears only where the data has a table (P7 D1). Null when the table
 * cannot be found or the roll fails.
 */
export function rollOnNamedTable(
  tableName: string,
  deps: RollTableDeps = defaultRollTableDeps
): string | null {
  const table = deps.findTable(tableName)
  if (!table) return null

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch — columns tables like the Callsign Table roll two d20s (column,
  // then entry). Shared with the Discord bot's /roll command.
  const outcome = rollOnTable(table.table, deps.rollD20)
  if (!outcome.success) return null

  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
