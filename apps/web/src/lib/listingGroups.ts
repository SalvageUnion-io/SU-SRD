import type { RefEntity } from 'salvageunion-reference'
import {
  bayKind,
  bookName,
  getPageReference,
  getSource,
  getTechLevel,
  getTree,
  getUniqueSources,
} from 'salvageunion-reference'

/**
 * How a schema listing groups its entities. The island groups its live grid
 * with these; the listing page groups its server render with the same, from
 * build-time data, so the grid the island mounts sits where the page's did.
 */

export type TechLevel = number | 'B' | 'N'

/** The book's tech-level order: TL1–6, then Bio-tech and Nanite. */
const TL_ORDER: readonly TechLevel[] = [1, 2, 3, 4, 5, 6, 'B', 'N']

/** A schema's tech levels in the book's order. */
export function orderTechLevels(techLevels: readonly TechLevel[]): TechLevel[] {
  return TL_ORDER.filter((tl) => techLevels.some((level) => String(level) === String(tl)))
}

/** A tech level as a group heading and a filter token say it. */
export function tlName(level: TechLevel): string {
  return level === 'B' ? 'Bio-tech' : level === 'N' ? 'Nanite' : `Tech Level ${level}`
}

/** A listing's groups, in the order the book prints them. */
export type ListingGroup = { key: string; label: string | undefined; items: RefEntity[] }

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
 * standard and expansion; a `SOURCE_LISTINGS` schema by the book each entry
 * comes from. The group heading then says what each card would otherwise
 * repeat (the tree on its type stamp, its TL cell).
 */
export type GroupBy = 'source' | 'tree' | 'tl' | 'kind' | 'bay' | 'none'

/**
 * Listings grouped by the book each entry comes from: the roll tables, the
 * core book's and each supplement's.
 */
const SOURCE_LISTINGS: ReadonlySet<string> = new Set(['roll-tables'])

/**
 * One group per book, headed by the name a cite prints for it (`bookName`:
 * "Workshop Manual" for the core book), in the order the rail's source filter
 * lists them (`getUniqueSources`: the core book, then the supplements by
 * name); within a book, by page. An entry sits under its own book only, so a
 * book that only reprints (the Starter Set's tables) heads no empty group.
 */
function groupBySource(items: RefEntity[]): ListingGroup[] {
  const bySource = new Map<string, RefEntity[]>()
  for (const item of items) {
    const source = getSource(item) ?? ''
    bySource.set(source, [...(bySource.get(source) ?? []), item])
  }
  return getUniqueSources(items)
    .filter((source) => bySource.has(source))
    .map((source) => ({
      key: `source:${source}`,
      label: bookName(source),
      // A stable sort keeps the dataset's order on a shared page.
      items: [...(bySource.get(source) ?? [])].sort(
        (a, b) => (getPageReference(a) ?? 0) - (getPageReference(b) ?? 0)
      ),
    }))
}

/**
 * How a Catalog groups its tiles: flat, except the classes, whose Core and
 * Hybrid classes each sit under their own heading.
 */
export function catalogGroupBy(schemaId: string): GroupBy {
  return schemaId === 'classes' ? 'kind' : 'none'
}

export function resolveGroupBy(
  items: RefEntity[],
  trees: string[],
  techLevels: TechLevel[],
  schemaId?: string
): GroupBy {
  if (schemaId && SOURCE_LISTINGS.has(schemaId)) return 'source'
  if (trees.length > 1) return 'tree'
  if (techLevels.length > 1 && items.every((item) => getTechLevel(item) != null)) return 'tl'
  if (items.length > 0 && items.every((item) => 'hybrid' in item)) return 'kind'
  if (items.length > 0 && items.every((item) => bayKind(item) != null)) return 'bay'
  return 'none'
}

export function groupEntities(items: RefEntity[], groupBy: GroupBy): ListingGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: undefined, items }]
  if (groupBy === 'source') return groupBySource(items)
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
              : 'Core Classes'
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
  items: RefEntity[],
  trees: string[],
  techLevels: readonly TechLevel[],
  schemaId?: string
): ListingGroup[] {
  return groupEntities(items, resolveGroupBy(items, trees, orderTechLevels(techLevels), schemaId))
}

/**
 * Listings whose cards carry a long row of value cells take a wider column, so
 * the cells hold one line beside the art (two across at the page's measure).
 */
export const WIDE_LISTINGS: ReadonlySet<string> = new Set(['chassis'])
