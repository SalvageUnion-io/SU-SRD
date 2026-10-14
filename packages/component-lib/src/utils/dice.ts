/**
 * The one dice source for the web apps: Randsum.
 *
 * - A roll on a **named** Salvage Union table (one of @randsum/salvageunion's
 *   `SALVAGE_UNION_TABLE_NAMES`) comes from that package's `rollTable(name)`.
 *   Only its total crosses back: callers resolve the row against the workspace
 *   `salvageunion-reference` data with the same total, so the text shown is
 *   always ours (`dice.test.ts` proves `rollTable`'s row is that row).
 * - Every other die — an entity-owned table, a Heat Check, a random Bay — is a
 *   plain die from @randsum/roller (`rollDie` / `rollD20`).
 *
 * There is no other source of randomness for a roll: no `Math.random`, no
 * hand-rolled crypto dice.
 */

import { roll } from '@randsum/roller'
import type { TableDice } from 'salvageunion-reference'
import { d20ForTable } from 'salvageunion-reference'
import type { Roll } from 'salvageunion-reference/rules'

/** One die of `sides` faces, from 1 to `sides`, rolled by @randsum/roller. */
export const rollDie: Roll = (sides) => roll({ sides }).total

/** One d20, rolled by @randsum/roller. */
export function rollD20(): number {
  return rollDie(20)
}

/** A d20 for one table: called once per roll on it. */
export type TableDie = () => number

let loading: Promise<TableDice> | undefined

/**
 * The dice a table rolls on: @randsum/salvageunion's named tables, loaded on
 * first use, and Randsum's plain d20.
 *
 * Dynamic on purpose, twice over. The package resolves to the workspace
 * `salvageunion-reference` (root `overrides`), and its module scope reads
 * `SalvageUnionReference.RollTables` to build `SALVAGE_UNION_TABLE_NAMES`,
 * which throws until `roll-tables` is loaded — so it can only be imported
 * after that preload. And no page pays for it until someone rolls.
 */
function loadTableDice(): Promise<TableDice> {
  loading ??= import('salvageunion-reference')
    .then(({ SalvageUnionReference }) => SalvageUnionReference.preload(['roll-tables']))
    .then(() => import('@randsum/salvageunion'))
    .then(({ SALVAGE_UNION_TABLE_NAMES, rollTable }) => ({
      names: SALVAGE_UNION_TABLE_NAMES,
      rollTable,
      rollD20,
    }))
    .catch((error: unknown) => {
      // A failed chunk load must not poison every later roll.
      loading = undefined
      throw error
    })
  return loading
}

/**
 * The die for a roll on `tableName`: salvageunion-reference's `d20ForTable`
 * over these dice — `rollTable(tableName)` when it is a named Salvage Union
 * table, Randsum's plain d20 otherwise (a table an entity owns).
 */
export async function dieForTable(tableName: string): Promise<TableDie> {
  return d20ForTable(tableName, await loadTableDice())
}

/**
 * A rules `Roll` (salvageunion-reference/rules) for one action that rolls on
 * `tableName`: its d20s come from `dieForTable(tableName)`, any other die (a
 * random Bay) from `rollDie`.
 *
 * `plainD20s` leading d20s are not on the table and stay plain: a Heat Check's
 * own d20 comes before its Reactor Overload roll. Use one per action — the
 * count is spent as it rolls.
 */
export async function rollForTable(
  tableName: string,
  { plainD20s = 0 }: { plainD20s?: number } = {}
): Promise<Roll> {
  const d20 = await dieForTable(tableName)
  let plain = plainD20s
  return (sides) => {
    if (sides !== 20) return rollDie(sides)
    if (plain > 0) {
      plain -= 1
      return rollD20()
    }
    return d20()
  }
}
