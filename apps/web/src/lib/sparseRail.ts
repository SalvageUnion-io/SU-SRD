import type { EntityRef, RefEntity, RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import {
  entityRef,
  getEntitySlug,
  getSchemaCatalog,
  SalvageUnionReference,
  toEntityModel,
} from 'salvageunion-reference'
import { buildChapters } from './chapters'
import { artUrlFor } from './sourceCovers'

/**
 * What a sparse Page's side column holds (EDL form 5, the Page): who uses the
 * entity and the rules that explain it. Every
 * piece is derived from the dataset as it stands; nothing new is stored.
 */

type Linked = { ref: EntityRef; name: string }

/** A user of the entity: its link, and its kind as the book names one ("System"). */
type UsedByRow = Linked & { kind: string }

export type SparseRail = {
  /** Every record that names it, in the chapters' order: the rail shows them all. */
  usedBy: UsedByRow[]
  rules: Linked[]
}

/** Fields that are the record's identity, never its words. */
const NOT_WORDS = new Set(['id', 'name', 'source', 'page', 'additionalSources', 'schemaName'])

/** A record's own words, lower-cased, for a term search. */
function wordsOf(entity: RefEntity): string {
  return JSON.stringify(entity, (key, value) => (NOT_WORDS.has(key) ? undefined : value))
    .replace(/\[\[|\]\]/g, '')
    .toLowerCase()
}

type Indexed = { schema: RefEnumSchemaName; entity: RefEntity; words: string }

let corpus: Indexed[] | undefined

/** Every reference record in the chapters' order, with its words: built once. */
function index(): Indexed[] {
  if (corpus) return corpus
  const schemas = buildChapters().flatMap((chapter) => chapter.rows.map((row) => row.schemaId))
  // A record names its actions; their words (and traits) are the record's own.
  const actions = new Map(
    (SalvageUnionReference.findAllIn('actions', () => true) as RefEntity[]).map((action) => [
      action.name,
      wordsOf(action),
    ])
  )
  const withActions = (entity: RefEntity) => {
    const named = 'actions' in entity && Array.isArray(entity.actions) ? entity.actions : []
    return [
      wordsOf(entity),
      ...named.map((name) => (typeof name === 'string' ? (actions.get(name) ?? '') : '')),
    ].join(' ')
  }
  corpus = schemas.flatMap((schema) => {
    const all = SalvageUnionReference.findAllIn(
      schema as RefEnumSchemaName,
      () => true
    ) as RefEntity[]
    return all.map((entity) => ({
      schema: schema as RefEnumSchemaName,
      entity,
      words: withActions(entity),
    }))
  })
  return corpus
}

const linked = (entity: RefEntity): Linked => ({
  ref: entityRef(entity as RefMetaEntity),
  name: entity.name,
})

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whether a Page is sparse: its record has no art, no stats, and no actions,
 * table, choices, patterns or abilities to fill its side column.
 */
export function isSparse(entity: RefEntity): boolean {
  const meta = entity as RefMetaEntity
  // A guide is its steps (and the tables they roll on): a page of its own length.
  if ((entity as { schemaName?: string }).schemaName === 'guides') return false
  if (artUrlFor(meta)) return false
  if (toEntityModel(meta).bookStats.length > 0) return false
  const json = JSON.stringify(entity)
  return !/"(actions|table|choices|patterns|abilities|systems|modules)":/.test(json)
}

/** The side column's pieces for a sparse Page, in their order. */
export function sparseRailFor(schema: RefEnumSchemaName, entity: RefEntity): SparseRail {
  const all = index()
  const name = entity.name.toLowerCase()
  const isTrait = schema === 'traits'
  const term = new RegExp(`(^|[^a-z])${escapeRegExp(name)}([^a-z]|$)`)
  // A range's users fire at it: its band in an action's range, never the word
  // in flavour text ("for as long as anyone remembers", RR6-11).
  const ranged = new RegExp(`"range":\\[[^\\]]*"${escapeRegExp(name)}"`)
  const users = all.filter(({ entity: other, words }) => {
    if (other.id === entity.id) return false
    if (isTrait)
      return (
        words.includes(`"type":"${name}"`) || words.includes(`"type":"${getEntitySlug(entity)}"`)
      )
    if (schema === 'distances') return ranged.test(words)
    return term.test(words)
  })
  const rules = all
    .filter(
      ({ schema: s, entity: other, words }) =>
        s === 'guides' && other.id !== entity.id && term.test(words)
    )
    .map(({ entity: other }) => linked(other))
  const kinds = new Map(getSchemaCatalog().schemas.map((meta) => [meta.id, meta.displayName]))
  return {
    usedBy: users.map(({ schema: s, entity: e }) => ({ ...linked(e), kind: kinds.get(s) ?? '' })),
    rules,
  }
}

/**
 * A roll table's side column: who sends a reader to it. A record does that
 * through an action that names the table (`tableName`), or in its own words
 * ("roll on the Reactor Overload Table"). The table's name alone is no link:
 * the Shield table is not every shield.
 */
export function tableRailFor(table: RefEntity): SparseRail {
  const name = table.name.toLowerCase()
  const named = `"tablename":${JSON.stringify(name)}`
  const phrase = /\btable\b/.test(name) ? name : `${name} table`
  const said = new RegExp(`(^|[^a-z])${escapeRegExp(phrase)}([^a-z]|$)`)
  const users = index().filter(
    ({ entity: other, words }) =>
      other.id !== table.id && (words.includes(named) || said.test(words))
  )
  const kinds = new Map(getSchemaCatalog().schemas.map((meta) => [meta.id, meta.displayName]))
  return {
    usedBy: users
      .filter(({ schema }) => schema !== 'guides')
      .map(({ schema, entity }) => ({ ...linked(entity), kind: kinds.get(schema) ?? '' })),
    rules: users.filter(({ schema }) => schema === 'guides').map(({ entity }) => linked(entity)),
  }
}

/** A Page's lists of what links to it, as `relationsFor` gives them. */
type RelationList = { key: string; rows: readonly { ref: EntityRef; name: string }[] }

/** The key of a keyword's own Related rules list (`relationsFor`). */
const RELATED_RULES = 'guides'

/**
 * ONE Related rules block on a Page with a rail. A keyword's Page lists the
 * guides that explain it (`relationsFor`), and its rail the guides that name
 * it: the same heading twice. The rail keeps the one list, the explaining
 * guides first, and the Page's own lists drop theirs. A Page whose rail lists
 * no rules keeps its own list as it was.
 */
export function oneRelatedRules<R extends RelationList>(
  rail: SparseRail | null,
  relations: readonly R[]
): { rail: SparseRail | null; relations: readonly R[] } {
  const explained = relations.find((relation) => relation.key === RELATED_RULES)
  if (!rail || !explained || rail.rules.length === 0) return { rail, relations }
  const first = explained.rows.map(({ ref, name }) => ({ ref, name }))
  const led = new Set(first.map((rule) => rule.ref.id))
  return {
    rail: { ...rail, rules: [...first, ...rail.rules.filter((rule) => !led.has(rule.ref.id))] },
    relations: relations.filter((relation) => relation !== explained),
  }
}
