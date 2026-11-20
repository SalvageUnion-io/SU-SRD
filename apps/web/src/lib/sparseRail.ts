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
 * entity, the rules that explain it, and its neighbours in its list. Every
 * piece is derived from the dataset as it stands; nothing new is stored.
 */

type Linked = { ref: EntityRef; name: string }

/** A user of the entity: its link, and its kind as the book names one ("System"). */
type UsedByRow = Linked & { kind: string }

export type SparseRail = {
  /** The list it sits in, named as its listing is ("Keywords"). */
  list: string
  /** Every record that names it, in the chapters' order: the rail shows them all. */
  usedBy: UsedByRow[]
  rules: Linked[]
  previous?: Linked
  next?: Linked
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
  const users = all.filter(({ entity: other, words }) => {
    if (other.id === entity.id) return false
    if (isTrait)
      return (
        words.includes(`"type":"${name}"`) || words.includes(`"type":"${getEntitySlug(entity)}"`)
      )
    return term.test(words)
  })
  const rules = all
    .filter(
      ({ schema: s, entity: other, words }) =>
        s === 'guides' && other.id !== entity.id && term.test(words)
    )
    .map(({ entity: other }) => linked(other))
  const kinds = new Map(getSchemaCatalog().schemas.map((meta) => [meta.id, meta.displayName]))
  const list =
    buildChapters()
      .flatMap((chapter) => chapter.rows)
      .find((row) => row.schemaId === schema)?.label ?? ''
  const siblings = all.filter(({ schema: s }) => s === schema)
  const at = siblings.findIndex(({ entity: other }) => other.id === entity.id)
  const previous = at > 0 ? siblings[at - 1]?.entity : undefined
  const next = at >= 0 ? siblings[at + 1]?.entity : undefined
  return {
    list,
    usedBy: users.map(({ schema: s, entity: e }) => ({ ...linked(e), kind: kinds.get(s) ?? '' })),
    rules,
    ...(previous ? { previous: linked(previous) } : {}),
    ...(next ? { next: linked(next) } : {}),
  }
}
