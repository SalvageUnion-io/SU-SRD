/**
 * A Page's CROSS-REFERENCES BACK (EDL E26: a cross-reference goes both ways),
 * derived at build time from the dataset as it stands; nothing new is stored.
 * Each is the far side of a link another Page already draws:
 *
 * - a system's or module's patterns (`fittedIn`): a pattern's loadout links it;
 * - a tech level's entries (`atTechLevel`): each one's `TL` chip links it;
 * - a book's entries by chapter (`inThisBook`): each one's cite links it;
 * - a crawler type's bays and a bay's crawler types (`sharesABook`): every
 *   Union Crawler has every bay its book prints;
 * - a keyword's guides and a guide's keywords (`rulesFor`): the guide's rules
 *   use the term, at least `GUIDE_USES` times;
 * - an entry's roll tables (`inTables`): the table's prose names it, and the
 *   table's page links that name (`nameRefIndexWithout`).
 */

import type { EntityRef, RefEntity, RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import {
  entityRef,
  getSchemaCatalog,
  getSources,
  getTechLevel,
  isBioTitanPattern,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { findNameRefs } from '../components/index'
import type { SideLinkList } from '../components/SideLinks'
import { referenceCopy } from '../messages/reference'
import { buildChapters } from './chapters'
import { nameRefIndexWithout } from './nameRefIndex'

/** One entry a relation lists: its link, its name, and a cell a column. */
type RelationRow = { ref: EntityRef; name: string; cells: (string | number)[] }

/** One list of a Page's relations, drawn as one Ledger. */
export type Relation = {
  key: string
  /** The list's title tab, which heads its names column (L2). */
  label: string
  columns: { key: string; label: string; kind: 'figure' | 'text' }[]
  rows: RelationRow[]
}

/** How often a guide's rules use a keyword before the two cite each other. */
const GUIDE_USES = 3

/** The kinds a roll table's prose names that list the table back. */
const TABLE_TARGETS: ReadonlySet<string> = new Set([
  'chassis',
  'systems',
  'modules',
  'equipment',
  'drones',
  'vehicles',
  'npcs',
  'squads',
  'creatures',
  'bio-titans',
  'meld',
  'factions',
  'crawler-bays',
])

const all = (schema: string): RefEntity[] =>
  SalvageUnionReference.findAllIn(schema as RefEnumSchemaName, () => true) as RefEntity[]

const kindNames = (): Map<string, string> =>
  new Map(getSchemaCatalog().schemas.map((meta) => [meta.id, meta.displayName]))

/** Every Page-bearing kind, in the chapters' order. */
function pageSchemas(): string[] {
  return buildChapters().flatMap((chapter) => chapter.rows.map((row) => row.schemaId))
}

const rowOf = (entity: RefEntity, cells: (string | number)[] = []): RelationRow => ({
  ref: entityRef(entity as RefMetaEntity),
  name: entity.name,
  cells,
})

const byName = (a: RelationRow, b: RelationRow) => a.name.localeCompare(b.name)

/** The patterns whose loadout installs `item` (a system or module), by chassis. */
function fittedIn(schema: string, item: RefEntity): RelationRow[] {
  const field = schema === 'systems' ? 'systems' : 'modules'
  const name = item.name.toLowerCase()
  return all('chassis').flatMap((chassis) => {
    const patterns =
      'patterns' in chassis && Array.isArray(chassis.patterns) ? chassis.patterns : []
    return patterns.flatMap((pattern) => {
      if (isBioTitanPattern(pattern)) return []
      const parts = (pattern[field] ?? []) as { name: string }[]
      if (!parts.some((part) => part.name.toLowerCase() === name)) return []
      return [
        {
          ref: { ...entityRef(chassis as RefMetaEntity), pattern: pattern.name },
          // As the book names one: "Hauler Pattern Mule".
          name: referenceCopy('patternOf', { pattern: pattern.name, chassis: chassis.name }),
          cells: [],
        },
      ]
    })
  })
}

/** The Page-bearing entries at tech level `level`, in the chapters' order. */
function atTechLevel(level: number): RelationRow[] {
  const kinds = kindNames()
  return pageSchemas()
    .filter((schema) => schema !== 'tech-levels')
    .flatMap((schema) =>
      all(schema)
        .filter((entity) => getTechLevel(entity as RefMetaEntity) === level)
        .map((entity) => rowOf(entity, [kinds.get(schema) ?? schema]))
        .sort(byName)
    )
}

/** The page `entity` is printed on in `book`, its own or a reprint's. */
function pageIn(entity: RefEntity, book: string): number | undefined {
  if ('source' in entity && entity.source === book) {
    return 'page' in entity && typeof entity.page === 'number' ? entity.page : undefined
  }
  const reprints = 'additionalSources' in entity ? entity.additionalSources : undefined
  const reprint = Array.isArray(reprints)
    ? (reprints as { source?: string; page?: number }[]).find((r) => r.source === book)
    : undefined
  return reprint?.page
}

/** A book's entries, one list a kind in the chapters' order, each by page. */
function inThisBook(book: RefEntity): Relation[] {
  const plural = new Map(
    getSchemaCatalog().schemas.map((meta) => [meta.id, meta.displayNamePlural])
  )
  return pageSchemas()
    .filter((schema) => schema !== 'sources')
    .flatMap((schema): Relation[] => {
      const rows = all(schema)
        .filter((entity) => getSources(entity as RefMetaEntity).includes(book.name))
        .map((entity) => rowOf(entity, [pageIn(entity, book.name) ?? '']))
        .sort((a, b) => Number(a.cells[0] || 0) - Number(b.cells[0] || 0) || byName(a, b))
      if (rows.length === 0) return []
      return [
        {
          key: `book:${schema}`,
          label: plural.get(schema) ?? schema,
          columns: [{ key: 'page', label: referenceCopy('relationPage'), kind: 'figure' }],
          rows,
        },
      ]
    })
}

/** Whether two entries are printed in a book they share. */
export function sharesABook(a: RefEntity, b: RefEntity): boolean {
  const books = new Set(getSources(a as RefMetaEntity))
  return getSources(b as RefMetaEntity).some((book) => books.has(book))
}

/** How many times `text` uses `term` as a word, its last word maybe plural. */
function uses(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.match(new RegExp(`(?<![A-Za-z])${escaped}s?(?![a-z])`, 'gi'))?.length ?? 0
}

/** A record's own words, less the fields that are its identity. */
function wordsOf(entity: RefEntity): string {
  const skip = new Set(['id', 'name', 'source', 'page', 'additionalSources'])
  return JSON.stringify(entity, (key, value) => (skip.has(key) ? undefined : value))
}

/** Whether a guide's rules use a keyword often enough that the two cite each other. */
export function guideExplains(guide: RefEntity, keyword: RefEntity): boolean {
  return uses(wordsOf(guide), keyword.name) >= GUIDE_USES
}

/** The entries of `targets` a roll table's prose links, as its page draws them. */
export function tableNames(table: RefEntity): EntityRef[] {
  const index = nameRefIndexWithout(table.id)
  const seen = new Map<string, EntityRef>()
  const texts: string[] = []
  JSON.stringify(table, (key, value) => {
    if (typeof value === 'string' && key !== 'id' && key !== 'source') texts.push(value)
    return value
  })
  for (const text of texts) {
    for (const match of findNameRefs(text, index)) {
      if (TABLE_TARGETS.has(match.ref.schemaName)) seen.set(match.ref.id, match.ref)
    }
  }
  return [...seen.values()]
}

let tablesByEntry: Map<string, RefEntity[]> | undefined

/** The roll tables whose prose names `id`: built once. */
function inTables(id: string): RefEntity[] {
  if (!tablesByEntry) {
    tablesByEntry = new Map()
    for (const table of all('roll-tables')) {
      for (const ref of tableNames(table)) {
        tablesByEntry.set(ref.id, [...(tablesByEntry.get(ref.id) ?? []), table])
      }
    }
  }
  return tablesByEntry.get(id) ?? []
}

const listOf = (key: string, label: string, rows: RelationRow[], kind?: string): Relation[] =>
  rows.length === 0
    ? []
    : [
        {
          key,
          label,
          columns: kind ? [{ key: 'kind', label: kind, kind: 'text' }] : [],
          rows,
        },
      ]

/** Every list of `item`'s relations back, for its Page (`schema` its kind). */
export function relationsFor(schema: string, item: RefEntity): Relation[] {
  const out: Relation[] = []
  if (schema === 'systems' || schema === 'modules') {
    out.push(...listOf('fitted-in', referenceCopy('fittedIn'), fittedIn(schema, item)))
  }
  if (schema === 'tech-levels') {
    const level = getTechLevel(item as RefMetaEntity)
    if (typeof level === 'number') {
      out.push(
        ...listOf(
          'at-level',
          referenceCopy('atTechLevel', { name: item.name }),
          atTechLevel(level),
          referenceCopy('relationKind')
        )
      )
    }
  }
  if (schema === 'sources') out.push(...inThisBook(item))
  if (schema === 'crawlers' || schema === 'crawler-bays') {
    const crawler = schema === 'crawlers'
    const others = all(crawler ? 'crawler-bays' : 'crawlers').filter((other) =>
      sharesABook(item, other)
    )
    out.push(
      ...listOf(
        crawler ? 'bays' : 'crawlers',
        crawler ? referenceCopy('crawlerBays') : referenceCopy('crawlerTypes'),
        others.map((other) => rowOf(other))
      )
    )
  }
  if (schema === 'keywords') {
    const guides = all('guides').filter((guide) => guideExplains(guide, item))
    out.push(
      ...listOf(
        'guides',
        referenceCopy('relatedRules'),
        guides.map((g) => rowOf(g))
      )
    )
  }
  if (schema === 'guides') {
    const keywords = all('keywords')
      .filter((keyword) => guideExplains(item, keyword))
      .map((k) => rowOf(k))
      .sort(byName)
    out.push(...listOf('keywords', referenceCopy('keywords'), keywords))
  }
  if (TABLE_TARGETS.has(schema)) {
    const tables = inTables(item.id)
      .map((t) => rowOf(t))
      .sort(byName)
    out.push(...listOf('tables', referenceCopy('rolledOn'), tables))
  }
  return out
}

/** The key of a Page's Rolled on list (`relationsFor`): its side column's. */
const ROLLED_ON = 'tables'

/** The band a list wears: its rows' kind's, or ink where they mix. */
export function relationTone(relation: Relation): string {
  const kinds = new Set(relation.rows.map((row) => row.ref.schemaName))
  const [first] = relation.rows
  if (kinds.size !== 1 || !first) return 'ink'
  const entity = SalvageUnionReference.get(first.ref.schemaName as never, first.ref.id)
  return entity ? toEntityModel(entity as RefMetaEntity).tone : 'ink'
}

/**
 * A Page's relations split: the Rolled on list goes to the side column, a
 * compact box of links (r7 review), and the rest stay full width.
 */
export function sideLinksOf(relations: readonly Relation[]): {
  side: SideLinkList | undefined
  rest: readonly Relation[]
} {
  const rolled = relations.find((relation) => relation.key === ROLLED_ON)
  if (!rolled) return { side: undefined, rest: relations }
  return {
    side: {
      label: rolled.label,
      tone: relationTone(rolled),
      rows: rolled.rows.map(({ ref, name }) => ({ ref, name })),
    },
    rest: relations.filter((relation) => relation !== rolled),
  }
}
