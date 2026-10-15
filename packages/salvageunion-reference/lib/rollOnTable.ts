/**
 * rollOnTable — the one shared orchestration for rolling on any Salvage Union
 * roll table (ADR-006 pure rules logic).
 *
 * The Discord bot's /roll command, the SRD and the Cantina's roll buttons need the
 * same dance: detect the table shape (isColumnsTable), roll one or two d20s,
 * unpack resultForTable / resultForColumnsTable, and tell a roll that lands on
 * no row ("No effect") apart from a broken table. This helper owns that
 * branch; consumers own dice presentation. The roller is injected so tests
 * (and future "roll with advantage" features) control the dice.
 *
 * `d20ForTable` picks that roller for a table by name. This package binds no
 * RNG (ADR-006), so the dice it chooses between are handed in by the app that
 * owns them (component-lib's and the bot's `dice.ts`).
 */

import type { SURefObjectTable } from './schemas/index'
import {
  isColumnsTable,
  isNoEffectRoll,
  resultForColumnsTable,
  resultForTable,
} from './utils/resultForTable'

/** A d20 roller: returns an integer 1–20. Injectable for tests. */
export type D20Roller = () => number

/** What a roll that lands on no row reads as, on every surface. */
export const NO_EFFECT = 'No effect'

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
  | {
      /**
       * A result, not an error: the roll matched no row of a well-formed
       * table. A `dramatic` table prints only its 20, so any other roll has no
       * effect. Every surface reads it as `NO_EFFECT`.
       */
      success: true
      kind: 'no-effect'
      /** The d20 roll that matched no row. */
      roll: number
    }
  | { success: false; error: string }

/**
 * Roll on a table's data, handling both flat d20 tables (one roll) and
 * columns-type tables (two rolls: column then entry). Never throws — a roll
 * that lands on no row comes back as `{ kind: 'no-effect' }`, malformed or
 * missing table data as `{ success: false }`.
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
  if (!outcome.success) {
    if (isNoEffectRoll(table, roll)) return { success: true, kind: 'no-effect', roll }
    return { success: false, error: outcome.result.value }
  }
  return {
    success: true,
    kind: 'flat',
    roll,
    key: outcome.key,
    label: outcome.result.label,
    value: outcome.result.value,
  }
}

/**
 * The dice a table can roll on, bound by the app that owns them: the names and
 * `rollTable` of @randsum/salvageunion, and a plain d20 for everything else.
 */
export type TableDice = {
  /** @randsum/salvageunion's `SALVAGE_UNION_TABLE_NAMES`. */
  names: readonly string[]
  /** @randsum/salvageunion's `rollTable`: only its total is read. */
  rollTable: (tableName: string) => { total: number }
  /** The plain d20, for a table that is not named (one an entity owns). */
  rollD20: D20Roller
}

/**
 * The d20 for a roll on `tableName`: `rollTable(name)` when it names a Salvage
 * Union table, matched ignoring case (a hand-typed `/su roll` name), and the
 * plain d20 otherwise. Only the die's total is used: `rollOnTable` reads the
 * row from the workspace data, so the text shown is always ours.
 */
export function d20ForTable(tableName: string, dice: TableDice): D20Roller {
  const wanted = tableName.toLowerCase()
  const named = dice.names.find((name) => name.toLowerCase() === wanted)
  return named === undefined ? dice.rollD20 : () => dice.rollTable(named).total
}
