import type { SURefEntity } from 'salvageunion-reference'
import { bayKind, getTechLevel, getTree } from 'salvageunion-reference'

/**
 * How a schema listing groups its entities. The island groups its live grid
 * with these; the listing page groups its server render with the same, from
 * build-time data, so the grid the island mounts sits where the page's did.
 */

export type TechLevel = number | 'B' | 'N'

/** The book's tech-level order: TL1–6, then Bio-tech and Nanite. */
export const TL_ORDER: readonly TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** A schema's tech levels in the book's order. */
export function orderTechLevels(techLevels: readonly TechLevel[]): TechLevel[] {
  return TL_ORDER.filter((tl) => techLevels.some((level) => String(level) === String(tl)))
}

/** A tech level as a group heading and a filter token say it. */
export function tlName(level: TechLevel): string {
  return level === 'B' ? 'Bio-tech' : level === 'N' ? 'Nanite' : `Tech Level ${level}`
}

/** A listing's groups, in the order the book prints them. */
export type ListingGroup = { key: string; label: string | undefined; items: SURefEntity[] }

/**
 * A listing's default shape, unfiltered: its size and each group's heading and
 * size. The island's skeleton takes it, as the server render does.
 */
export type ListingShape = {
  count: number
  groups: { key: string; label: string | undefined; count: number }[]
}

/**
 * How a listing groups its entities, by data shape: abilities by tree, gear and
 * chassis by tech level, classes into base and hybrid, crawler bays into
 * standard and expansion. The group heading then says what each card would
 * otherwise repeat (the tree on its type stamp, its TL cell).
 */
export type GroupBy = 'tree' | 'tl' | 'kind' | 'bay' | 'none'

export function resolveGroupBy(
  items: SURefEntity[],
  trees: string[],
  techLevels: TechLevel[]
): GroupBy {
  if (trees.length > 1) return 'tree'
  if (techLevels.length > 1 && items.every((item) => getTechLevel(item) != null)) return 'tl'
  if (items.length > 0 && items.every((item) => 'hybrid' in item)) return 'kind'
  if (items.length > 0 && items.every((item) => bayKind(item) != null)) return 'bay'
  return 'none'
}

export function groupEntities(items: SURefEntity[], groupBy: GroupBy): ListingGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: undefined, items }]
  const byKey = new Map<string, ListingGroup>()
  for (const item of items) {
    const tl = getTechLevel(item)
    const tree = getTree(item)
    const hybrid = 'hybrid' in item && item.hybrid === true
    const bay = bayKind(item)
    const key =
      groupBy === 'tree'
        ? String(tree ?? '')
        : groupBy === 'tl'
          ? String(tl ?? '')
          : groupBy === 'bay'
            ? String(bay).toLowerCase()
            : hybrid
              ? 'hybrid'
              : 'base'
    const label =
      groupBy === 'tree'
        ? `${String(tree ?? '')} Tree`
        : groupBy === 'tl'
          ? tl != null
            ? tlName(tl)
            : ''
          : groupBy === 'bay'
            ? `${String(bay)} Bays`
            : hybrid
              ? 'Hybrid Classes'
              : 'Base Classes'
    const group = byKey.get(key) ?? { key, label, items: [] }
    group.items.push(item)
    byKey.set(key, group)
  }
  const groups = [...byKey.values()]
  if (groupBy === 'tl') {
    const rank = (key: string) => TL_ORDER.findIndex((tl) => String(tl) === key)
    groups.sort((a, b) => rank(a.key) - rank(b.key))
  }
  if (groupBy === 'kind') groups.sort((a) => (a.key === 'base' ? -1 : 1))
  if (groupBy === 'bay') groups.sort((a) => (a.key === 'standard' ? -1 : 1))
  return groups
}

/** A listing's default groups, unfiltered: what the island renders on mount. */
export function defaultGroups(
  items: SURefEntity[],
  trees: string[],
  techLevels: readonly TechLevel[]
): ListingGroup[] {
  return groupEntities(items, resolveGroupBy(items, trees, orderTechLevels(techLevels)))
}

/**
 * Listings whose cards carry a long row of value cells take a wider column, so
 * the cells hold one line beside the art (two across at the page's measure).
 */
export const WIDE_LISTINGS: ReadonlySet<string> = new Set(['chassis'])
