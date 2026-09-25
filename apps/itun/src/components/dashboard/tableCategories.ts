/**
 * Roll-table categories for the Dashboard Tables picker (D3).
 *
 * Roll tables carry no category field in the reference data, so the 5-column
 * picker (COMBAT / PILOT / SALVAGE / CRAWLER / DOWNTIME) is driven by this
 * app-side curated `name → category` map. Tables not named here fall through
 * to a couple of substring rules and finally the COMBAT default — most of the
 * long tail is per-system/per-module effect tables and adventure encounters,
 * all of which read as in-play combat rolls.
 *
 * This is a pure lookup over table *names*; it never touches the ORM at module
 * scope (the preload hazard) — callers pass names in from `RollTables.all()`.
 */

export type TableCategory = 'COMBAT' | 'PILOT' | 'SALVAGE' | 'CRAWLER' | 'DOWNTIME'

/** Column order for the picker, left → right. */
export const TABLE_CATEGORY_ORDER: readonly TableCategory[] = [
  'COMBAT',
  'PILOT',
  'SALVAGE',
  'CRAWLER',
  'DOWNTIME',
] as const

/** Human labels are the category keys themselves (already display-ready). */
export const TABLE_CATEGORY_LABEL: Readonly<Record<TableCategory, string>> = {
  COMBAT: 'Combat',
  PILOT: 'Pilot',
  SALVAGE: 'Salvage',
  CRAWLER: 'Crawler',
  DOWNTIME: 'Downtime',
} as const

/**
 * Curated name → category. Only the headline / flavour tables that belong
 * *away* from the COMBAT default are listed; everything else is resolved by
 * `categorizeTable` below.
 */
const CURATED_TABLE_CATEGORY: Readonly<Record<string, TableCategory>> = {
  // COMBAT — in-play resolution, initiative, damage, NPC behaviour.
  'Core Mechanic': 'COMBAT',
  'Group Initiative': 'COMBAT',
  'Critical Damage': 'COMBAT',
  'Reactor Overload': 'COMBAT',
  'Reaction Roll': 'COMBAT',
  'NPC Action': 'COMBAT',
  Morale: 'COMBAT',
  Retreat: 'COMBAT',

  // PILOT — pilot creation, flavour, and personal injury.
  'Critical Injury': 'PILOT',
  Keepsake: 'PILOT',
  Motto: 'PILOT',
  'Pilot Appearance': 'PILOT',
  'A.I. Personality': 'PILOT',
  Quirks: 'PILOT',
  'Mech Appearance': 'PILOT',
  'Mech Pattern Names': 'PILOT',
  'Callsign Table': 'PILOT',
  Background: 'PILOT',

  // SALVAGE — salvage/harvest yields (the `/salvage/i` rule catches the rest).
  'Harvesting Chimerium': 'SALVAGE',
  'Heart of Ygdriss Removal Table': 'SALVAGE',

  // DOWNTIME — rumours, trading, and deal-making back at the Crawler.
  Rumour: 'DOWNTIME',
  'Rumour Table': 'DOWNTIME',
  'Trading Bay': 'DOWNTIME',
  'Improved Trading Bay': 'DOWNTIME',
  "Let's Make a Deal": 'DOWNTIME',
}

/**
 * Resolve a roll table's picker category from its name. Deterministic:
 * curated map first, then substring rules for the obvious Crawler/Salvage
 * families, then the COMBAT default.
 */
export function categorizeTable(name: string): TableCategory {
  const curated = CURATED_TABLE_CATEGORY[name]
  if (curated) return curated
  if (/crawler/i.test(name)) return 'CRAWLER'
  if (/salvage/i.test(name)) return 'SALVAGE'
  return 'COMBAT'
}

export type PickableTable = { id: string; name: string }

/**
 * Group tables into the fixed 5-category order. Every category key is present
 * (possibly with an empty list) so the picker always renders 5 columns; each
 * column's tables are sorted alphabetically by name.
 */
export function groupTablesByCategory(
  tables: readonly PickableTable[]
): Array<{ category: TableCategory; tables: PickableTable[] }> {
  const buckets = new Map<TableCategory, PickableTable[]>(TABLE_CATEGORY_ORDER.map((c) => [c, []]))
  for (const t of tables) {
    buckets.get(categorizeTable(t.name))?.push(t)
  }
  return TABLE_CATEGORY_ORDER.map((category) => ({
    category,
    tables: [...(buckets.get(category) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }))
}
