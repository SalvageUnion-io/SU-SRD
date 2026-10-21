/**
 * Pure helpers for rolling on salvageunion-reference roll tables.
 * Isolated from React so they can be tested without a DOM.
 */

import type { RefRollTable } from 'salvageunion-reference'
import { NO_EFFECT, rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import type { TableDie } from '../../components/index'
import { dieForTable } from '../../components/index'

/** Roll IDs for pilot wizard identity fields. */
export const PILOT_ROLL_TABLE_NAMES = {
  callsign: 'Callsign Table',
  motto: 'Motto',
  keepsake: 'Keepsake',
  appearance: 'Pilot Appearance',
  background: 'Background',
} as const

export type PilotRollField = keyof typeof PILOT_ROLL_TABLE_NAMES

/** Roll-table names for the mech wizard's flavor fields (Mech Workshop steps
 *  6–8: Quirks p.208, Mech Appearance p.208, Mech Pattern Names p.209). */
export const MECH_ROLL_TABLE_NAMES = {
  quirk: 'Quirks',
  appearance: 'Mech Appearance',
  patternName: 'Mech Pattern Names',
} as const

export type MechRollField = keyof typeof MECH_ROLL_TABLE_NAMES

/** The crawler wizard's name table (Union Crawler step 5, p.212; the table p.226). */
export const CRAWLER_NAME_TABLE = 'Crawler Name'

/**
 * Dependency interface for roll table lookup — injectable for testing.
 */
export type RollTableDeps = {
  findTable: (name: string) => (RefRollTable & { schemaName: string }) | undefined
  /** The die for a table, by name (the UI library's `dieForTable`). */
  d20For: (tableName: string) => Promise<TableDie>
}

/**
 * Default production deps — read from SalvageUnionReference; the die is
 * @randsum/salvageunion's `rollTable` for a named Salvage Union table (a
 * choice can point at Critical Injury), Randsum's plain d20 otherwise.
 */
const defaultRollTableDeps: RollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.getByName(name),
  d20For: dieForTable,
}

/**
 * Rolls a d20 (1–20 inclusive) and returns the result string for the given
 * pilot field (`NO_EFFECT` when it lands on no row). Returns null if the
 * table cannot be found or the roll fails.
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
 * Roll appears only where the data has a table (P7 D1). `NO_EFFECT` when the
 * roll lands on no row; null when the table cannot be found or is broken.
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
  // A roll that lands on no row reads as it does on the SRD and in the bot.
  if (outcome.kind === 'no-effect') return NO_EFFECT

  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
