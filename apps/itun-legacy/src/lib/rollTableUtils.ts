/**
 * Shared roll-table resolution helper.
 *
 * This file is the canonical location for roll-table resolution with a
 * pre-rolled value. Stories 1C (salvageUtils) and 2B (combat guides)
 * import from this path.
 *
 * Contrast with `rollOnTable` in pilotUtils.ts, which rolls internally
 * and returns `{ text, roll }`. This function accepts a pre-rolled value
 * and returns the structured entry directly, for callers that already
 * have a roll (e.g. a player reported their physical dice result).
 */

import { SalvageUnionReference, resultForTable } from 'salvageunion-reference'

/**
 * Resolve a roll-table entry for a given pre-rolled value.
 *
 * @param tableSlug - The `name` field of the roll table (e.g. 'Reactor Overload').
 * @param roll - The pre-rolled die value (1–20 for a d20 table).
 * @returns The matching entry `{ label?, value }`, or `null` if the table
 *          does not exist or no entry matches the roll.
 */
export function resolveRollTable(
  tableSlug: string,
  roll: number
): { label?: string; value: string } | null {
  const rollTable = SalvageUnionReference.RollTables.find((rt) => rt.name === tableSlug)
  if (!rollTable?.table) return null

  const result = resultForTable(rollTable.table, roll)
  if (!result.success) return null

  return result.result
}
