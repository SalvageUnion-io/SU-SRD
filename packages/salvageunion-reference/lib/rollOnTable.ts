/**
 * rollOnTable — the one shared orchestration for rolling on any Salvage Union
 * roll table (ADR-006 pure rules logic).
 *
 * Both the Discord bot's /roll command and ITUN's pilot-identity roll buttons
 * previously reimplemented the same dance: detect the table shape
 * (isColumnsTable), roll one or two d20s, unpack resultForTable /
 * resultForColumnsTable. This helper owns that branch; consumers own dice
 * presentation. The roller is injected so tests (and future "roll with
 * advantage" features) control the dice.
 */

import type { SURefObjectTable } from './types/index.js'
import { isColumnsTable, resultForColumnsTable, resultForTable } from './utils/resultForTable.js'

/** A d20 roller: returns an integer 1–20. Injectable for tests. */
export type D20Roller = () => number

export type RollOnTableOutcome =
  | {
      success: true
      kind: 'flat'
      /** The single d20 roll. */
      roll: number
      /** The matched range key (e.g. "11-19"). */
      key: string
      label?: string
      value: string
    }
  | {
      success: true
      kind: 'columns'
      /** First d20 — selects the column (e.g. "1-4"). */
      columnRoll: number
      /** Second d20 — selects the entry within the column. */
      entryRoll: number
      columnKey: string
      entryKey: string | number
      label?: string
      value: string
    }
  | { success: false; error: string }

/**
 * Roll on a table's data, handling both flat d20 tables (one roll) and
 * columns-type tables (two rolls: column then entry). Never throws — malformed
 * or missing table data comes back as `{ success: false }`.
 */
export function rollOnTable(
  table: SURefObjectTable | undefined,
  rollD20: D20Roller
): RollOnTableOutcome {
  if (isColumnsTable(table)) {
    const columnRoll = rollD20()
    const entryRoll = rollD20()
    const outcome = resultForColumnsTable(table, columnRoll, entryRoll)
    if (!outcome.success) return { success: false, error: outcome.result.value }
    return {
      success: true,
      kind: 'columns',
      columnRoll,
      entryRoll,
      columnKey: outcome.columnKey,
      entryKey: outcome.entryKey,
      label: outcome.result.label,
      value: outcome.result.value,
    }
  }

  const roll = rollD20()
  const outcome = resultForTable(table, roll)
  if (!outcome.success) return { success: false, error: outcome.result.value }
  return {
    success: true,
    kind: 'flat',
    roll,
    key: outcome.key,
    label: outcome.result.label,
    value: outcome.result.value,
  }
}
