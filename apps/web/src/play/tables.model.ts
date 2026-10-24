/**
 * The Tables section's pinned tables (play.md §8), pure: the roll tables the
 * Situation needs to hand, by their names in the reference data. A fight, on
 * foot or Boarded, pins the combat tables; Downtime pins the Core Mechanic,
 * Critical Injury (a pilot heals between Scenes) and the Rumour table. Every
 * other table is a "Roll a table…" search away (`findTables`).
 *
 * Boarded in a Bio-Chassis, the fight pins its own Damage and Overload tables
 * in place of Critical Damage and Reactor Overload (We Were Here First
 * pp.78-79).
 */

import type { OverloadTable } from 'salvageunion-reference/rules'
import { damageTableName, overloadTableName } from 'salvageunion-reference/rules'

/** The combat tables, On foot or Boarded. */
const COMBAT_TABLES = [
  'Core Mechanic',
  'Critical Damage',
  'Reactor Overload',
  'Critical Injury',
] as const

/** The Core Mechanic, first of the combat tables: the table every check rolls on. */
export const CORE_MECHANIC_TABLE = COMBAT_TABLES[0]

/** Downtime's tables. */
const DOWNTIME_TABLES = ['Core Mechanic', 'Critical Injury', 'Rumour'] as const

/** The tables pinned for this Situation, the fight's for the mech's tables. */
export function pinnedTables(
  downtime: boolean,
  mechTables: OverloadTable = 'reactor'
): readonly string[] {
  if (downtime) return DOWNTIME_TABLES
  if (mechTables === 'reactor') return COMBAT_TABLES
  return [
    'Core Mechanic',
    damageTableName(mechTables),
    overloadTableName(mechTables),
    'Critical Injury',
  ]
}

/** How many tables a search lists at once. */
const FIND_LIMIT = 6

/**
 * The tables whose name holds `query` (case-insensitive), names that start
 * with it first, then A–Z, at most `FIND_LIMIT`. An empty query finds none:
 * the pinned buttons are what shows then.
 */
export function findTables(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []
  return names
    .filter((name) => name.toLowerCase().includes(q))
    .sort((a, b) => {
      const starts = Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q))
      return starts !== 0 ? starts : a.localeCompare(b)
    })
    .slice(0, FIND_LIMIT)
}
