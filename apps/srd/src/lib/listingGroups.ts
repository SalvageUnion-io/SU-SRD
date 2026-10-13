import type { SURefEntity } from 'salvageunion-reference'
import { bayKind, getPageReference, getSource, getTechLevel, getTree } from 'salvageunion-reference'

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
 * standard and expansion; a `CHAPTER_LISTINGS` schema by the chapter of the
 * book it is printed in. The group heading then says what each card would
 * otherwise repeat (the tree on its type stamp, its TL cell).
 */
export type GroupBy = 'chapter' | 'tree' | 'tl' | 'kind' | 'bay' | 'none'

/**
 * Listings grouped by where the book prints each entry (`chapterOf`): the roll
 * tables, whose 96 cards were one run with the supplements' tables mixed in
 * among the core book's.
 */
const CHAPTER_LISTINGS: ReadonlySet<string> = new Set(['roll-tables'])

const CORE_BOOK = 'Salvage Union Workshop Manual'

/**
 * The Workshop Manual's chapters by their first page (its Contents, p. 7):
 * Pilot Bay p. 18 (its Pilot Tables pp. 88–93), Mech Workshop p. 94 (Mech
 * Tables pp. 208–211), Union Crawler p. 212 (to p. 231), Core Rules
 * pp. 232–251, Mediator Advice p. 252, Denizens of the Wasteland p. 266 (its
 * NPC Actions, Reactions & Morale p. 267, Encounter Tables p. 270), The
 * Downing of the Atychos p. 304, Keywords and Traits p. 318 and Reference
 * Tables p. 336. A chapter's own tables sit at its end; the tables an
 * ability, system or module prints sit with it, in the same chapter.
 */
const CORE_CHAPTERS: readonly { firstPage: number; label: string }[] = [
  { firstPage: 18, label: 'Pilot Bay' },
  { firstPage: 94, label: 'Mech Workshop' },
  { firstPage: 212, label: 'Union Crawler' },
  { firstPage: 232, label: 'Core Rules' },
  { firstPage: 252, label: 'Mediator Advice' },
  { firstPage: 266, label: 'Denizens of the Wasteland' },
  { firstPage: 304, label: 'The Downing of the Atychos' },
  { firstPage: 318, label: 'Keywords and Traits' },
  { firstPage: 336, label: 'Reference Tables' },
]

/**
 * Where the book prints an entry: a Workshop Manual entry's chapter, by its
 * page, ranked in the book's order; a supplement's entry under its source,
 * after the core book. `rank` orders the groups: the core chapters by their
 * place, then the supplements by name, as the rail's source filter lists them.
 */
export function chapterOf(item: SURefEntity): { key: string; label: string; rank: number } {
  const source = getSource(item) ?? ''
  if (source !== CORE_BOOK) {
    return { key: `source:${source}`, label: source, rank: CORE_CHAPTERS.length }
  }
  const page = getPageReference(item) ?? 0
  const index = CORE_CHAPTERS.filter((chapter) => chapter.firstPage <= page).length - 1
  const chapter = CORE_CHAPTERS[index]
  // An entry before the first chapter (or with no page) is the core book's,
  // ahead of its chapters.
  if (!chapter) return { key: 'core', label: 'Workshop Manual', rank: -1 }
  return { key: `core:${chapter.label}`, label: chapter.label, rank: index }
}

function groupByChapter(items: SURefEntity[]): ListingGroup[] {
  const byKey = new Map<string, ListingGroup & { rank: number }>()
  for (const item of items) {
    const { key, label, rank } = chapterOf(item)
    const group = byKey.get(key) ?? { key, label, rank, items: [] }
    group.items.push(item)
    byKey.set(key, group)
  }
  return [...byKey.values()]
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ key, label, items: entries }) => ({
      key,
      label,
      // The book's order within a chapter: by page (a stable sort keeps the
      // dataset's order on a shared page).
      items: [...entries].sort((a, b) => (getPageReference(a) ?? 0) - (getPageReference(b) ?? 0)),
    }))
}

export function resolveGroupBy(
  items: SURefEntity[],
  trees: string[],
  techLevels: TechLevel[],
  schemaId?: string
): GroupBy {
  if (schemaId && CHAPTER_LISTINGS.has(schemaId)) return 'chapter'
  if (trees.length > 1) return 'tree'
  if (techLevels.length > 1 && items.every((item) => getTechLevel(item) != null)) return 'tl'
  if (items.length > 0 && items.every((item) => 'hybrid' in item)) return 'kind'
  if (items.length > 0 && items.every((item) => bayKind(item) != null)) return 'bay'
  return 'none'
}

export function groupEntities(items: SURefEntity[], groupBy: GroupBy): ListingGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: undefined, items }]
  if (groupBy === 'chapter') return groupByChapter(items)
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
