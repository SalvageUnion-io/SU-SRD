/**
 * Pure helpers for rolling on salvageunion-reference roll tables.
 * Isolated from React so they can be tested without a DOM.
 */

import type { TableDie } from 'component-lib'
import { d20ForTable } from 'component-lib'
import type { SURefRollTable } from 'salvageunion-reference'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'

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
  /** The die for a table, by name (component-lib's `d20ForTable`). */
  d20For: (tableName: string) => Promise<TableDie>
}

/**
 * Default production deps — read from SalvageUnionReference; the die is
 * @randsum/salvageunion's `rollTable` for a named Salvage Union table (a
 * choice can point at Critical Injury), Randsum's plain d20 otherwise.
 */
const defaultRollTableDeps: RollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.getByName(name),
  d20For: d20ForTable,
}

/**
 * Rolls a d20 (1–20 inclusive) and returns the result string for the given
 * pilot field. Returns null if the table cannot be found or the roll fails.
 */
export function rollForPilotField(
  field: PilotRollField,
  deps: RollTableDeps = defaultRollTableDeps
): Promise<string | null> {
  return rollOnNamedTable(PILOT_ROLL_TABLE_NAMES[field], deps)
}

/**
 * Rolls on any roll table by its name — the one a choice's data points at
 * (`source.rollTable`, e.g. the Augmented crawler's "A.I. Personality"), so a
 * Roll appears only where the data has a table (P7 D1). Null when the table
 * cannot be found or the roll fails.
 */
export async function rollOnNamedTable(
  tableName: string,
  deps: RollTableDeps = defaultRollTableDeps
): Promise<string | null> {
  const table = deps.findTable(tableName)
  if (!table) return null

  // rollOnTable (salvageunion-reference, ADR-006) owns the flat-vs-columns
  // branch — columns tables like the Callsign Table roll two d20s (column,
  // then entry). Shared with the Discord bot's /roll command. The row is read
  // from the workspace table by the die's total, whichever die it was.
  const outcome = rollOnTable(table.table, await deps.d20For(table.name))
  if (!outcome.success) return null

  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
