/**
 * The bot's dice — Randsum, and nothing else.
 *
 * A roll on a named Salvage Union table (one of @randsum/salvageunion's
 * `SALVAGE_UNION_TABLE_NAMES`) comes from that package's `rollTable(name)`;
 * every other table gets @randsum/roller's d20. Only the total crosses back:
 * `rollOnTable` resolves the row against the workspace data with it, so the
 * reply's text is always ours.
 */

import { roll } from '@randsum/roller'

/** One d20, rolled by @randsum/roller. */
export function rollD20(): number {
  return roll({ sides: 20 }).total
}

/**
 * The d20 for a roll on `tableName` (matched as `/su roll` matches a typed
 * name, ignoring case): `rollTable(name)` for a named table, `rollD20`
 * otherwise.
 *
 * The import is dynamic because the package's module scope reads
 * `SalvageUnionReference.RollTables`, which throws until it is loaded: a static
 * import would evaluate before `worker.ts`'s top-level `preload('all')`.
 */
export async function d20ForTable(tableName: string): Promise<() => number> {
  const { SALVAGE_UNION_TABLE_NAMES, rollTable } = await import('@randsum/salvageunion')
  const wanted = tableName.toLowerCase()
  const named = SALVAGE_UNION_TABLE_NAMES.find((name) => name.toLowerCase() === wanted)
  return named === undefined ? rollD20 : () => rollTable(named).total
}
