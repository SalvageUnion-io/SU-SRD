/**
 * Catalog-choice resolution — turn a `source.kind: 'catalog'` choice into the
 * live set of entities it lets you pick from.
 *
 * A catalog choice names one or more schema collections and, optionally, a
 * filter. The two shapes:
 *
 * - **Shortlist** (`entities` / legacy `schemaEntities`) — a fixed set of named
 *   entities (e.g. Weapon Type → Ballistic / Energy). Resolved by name.
 * - **Schema-only** (no shortlist) — "pick any X from the collection", narrowed
 *   by `filter`. The Armament Bay's Weapons System is the canonical case: any
 *   Mech System that deals SP damage (`filter.damageType: 'SP'`), of the
 *   crawler's Tech Level or lower.
 *
 * A System record carries no damage itself — damage lives on the actions it
 * references — so the `damageType` filter resolves each candidate's actions and
 * keeps those that deal the requested type (this is the same rule as
 * `isWeaponSystem`, made damage-type-explicit). Requires the referenced schemas
 * (and `actions`, for a `damageType` filter) to be preloaded.
 */
import { SalvageUnionReference } from '../index.js'
import type { SURefMetaAction, SURefMetaEntity, SURefObjectChoice } from '../types/index.js'

type DamageType = 'HP' | 'SP'

/** The schema-name list a catalog references (the choice's own `schema` type). */
type CatalogSchema = NonNullable<SURefObjectChoice['schema']>

type CatalogFilter = {
  field?: string
  min?: number
  max?: number
  damageType?: DamageType
}

/** True when any of `entity`'s resolved actions deals `damageType` damage. */
function dealsDamageType(entity: SURefMetaEntity, damageType: DamageType): boolean {
  const actions: SURefMetaAction[] = SalvageUnionReference.resolveActions(entity) ?? []
  return actions.some((action) => action.damage?.damageType === damageType)
}

/** Apply a catalog `filter` to a single candidate entity. */
function matchesFilter(entity: SURefMetaEntity, filter: CatalogFilter): boolean {
  if (filter.damageType && !dealsDamageType(entity, filter.damageType)) return false
  if (filter.field) {
    const value = (entity as Record<string, unknown>)[filter.field]
    if (typeof value !== 'number') return false
    if (typeof filter.min === 'number' && value < filter.min) return false
    if (typeof filter.max === 'number' && value > filter.max) return false
  }
  return true
}

/** Stable listing order: Tech Level ascending (non-numeric last), then name. */
function byTechThenName(a: SURefMetaEntity, b: SURefMetaEntity): number {
  const tl = (e: SURefMetaEntity): number => {
    const v = 'techLevel' in e ? e.techLevel : undefined
    return typeof v === 'number' ? v : Number.POSITIVE_INFINITY
  }
  const diff = tl(a) - tl(b)
  if (diff !== 0) return diff
  const an = typeof a.name === 'string' ? a.name : ''
  const bn = typeof b.name === 'string' ? b.name : ''
  return an.localeCompare(bn)
}

/** The catalog fields, read from the unified `source` or the legacy fields. */
function catalogSpec(choice: SURefObjectChoice): {
  schema?: CatalogSchema
  shortlist?: string[]
  filter?: CatalogFilter
} {
  if (choice.source?.kind === 'catalog') {
    return {
      schema: choice.source.schema,
      shortlist: choice.source.entities,
      filter: choice.source.filter,
    }
  }
  return { schema: choice.schema, shortlist: choice.schemaEntities }
}

/**
 * Resolve the entities a catalog choice offers.
 *
 * - A shortlist choice resolves its named entities across the schema(s).
 * - A schema-only choice resolves the whole collection, narrowed by `filter`.
 * - When `opts.techLevel` is a number, entities carrying a higher numeric
 *   `techLevel` are dropped (the crawler mounts its Tech Level or lower).
 *
 * Returns `[]` for any non-catalog choice, or a catalog with no schema.
 */
export function resolveCatalogChoiceEntities(
  choice: SURefObjectChoice,
  opts?: { techLevel?: number }
): SURefMetaEntity[] {
  const { schema, shortlist, filter } = catalogSpec(choice)
  if (!schema || schema.length === 0) return []

  const all = SalvageUnionReference.getAllBySchemaNames(schema).map((row) => row.entity)

  let entities: SURefMetaEntity[]
  if (shortlist && shortlist.length > 0) {
    const names = new Set(shortlist)
    entities = all.filter((e) => typeof e.name === 'string' && names.has(e.name))
  } else if (filter) {
    entities = all.filter((e) => matchesFilter(e, filter))
  } else {
    entities = all
  }

  if (typeof opts?.techLevel === 'number') {
    const cap = opts.techLevel
    entities = entities.filter((e) => {
      if (!('techLevel' in e)) return true // no Tech Level → not capped
      const tl = e.techLevel
      // "of the Tech Level or lower" — numeric ≤ cap; a non-numeric Tech Level
      // (N/B) is not "of a lower Tech Level" and is excluded (matches the
      // crawler wizard's numeric-only weapon cap).
      return typeof tl === 'number' && tl <= cap
    })
  }

  return entities.slice().sort(byTechThenName)
}

/**
 * Whether a choice is a **schema-only** catalog — "pick any entity from the
 * collection" (no fixed shortlist). These render as an entity listing; a
 * shortlist catalog renders as an option-card grid instead.
 */
export function isSchemaOnlyCatalogChoice(choice: SURefObjectChoice): boolean {
  const { schema, shortlist } = catalogSpec(choice)
  return !!schema && schema.length > 0 && (!shortlist || shortlist.length === 0)
}
