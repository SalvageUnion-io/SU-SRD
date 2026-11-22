import type { EntityModel, RefEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'

/**
 * A listing's FIELD facets (r4 F6): filters built from what its List already
 * prints in columns, never from new data. A range band, an action type, and
 * "weapons only" (the rows that deal damage).
 */
export type ListingFieldFacets = {
  /** The range bands some row reaches, in the book's order (Close … Far). */
  ranges: string[]
  /** The action types some row takes, the commonest first. */
  actions: string[]
  /** Some rows deal damage and some do not: "Weapons only" picks the first. */
  weapons: boolean
}

type Facts = Pick<EntityModel, 'facts'>

const factOf = (model: Facts, key: string): string => {
  const found = model.facts.find((entry) => entry.key === key)
  return found ? String(found.value) : ''
}

/** The range bands a row reaches, as its RNG cell prints them ("Close / Long" is two). */
export function entityRanges(model: Facts): string[] {
  return factOf(model, 'range')
    .split('/')
    .map((band) => band.trim())
    .filter(Boolean)
}

/** A row's action type, as its Action cell prints it; none for a row that takes no action. */
export function entityAction(model: Pick<EntityModel, 'actionType' | 'mechActionType'>): string {
  return model.actionType ?? model.mechActionType ?? ''
}

/** Whether a row is a weapon: its DMG cell is filled. */
export function dealsDamage(model: Facts): boolean {
  return factOf(model, 'damage') !== ''
}

/** The listings that offer field facets. */
const FIELD_FACET_LISTINGS: ReadonlySet<string> = new Set(['systems'])

/** The range bands in the book's order; a band it does not name sorts last. */
const BAND_ORDER = ['Close', 'Medium', 'Long', 'Far']

const bandRank = (band: string) => {
  const at = BAND_ORDER.indexOf(band)
  return at === -1 ? BAND_ORDER.length : at
}

/** The field facets `schemaId`'s listing offers over `entities`, or none. */
export function listingFieldFacets(
  schemaId: string,
  entities: readonly RefEntity[]
): ListingFieldFacets | undefined {
  if (!FIELD_FACET_LISTINGS.has(schemaId)) return undefined
  const ranges = new Set<string>()
  const actions = new Map<string, number>()
  let weapons = 0
  for (const entity of entities) {
    const model = toEntityModel(entity)
    for (const band of entityRanges(model)) ranges.add(band)
    const action = entityAction(model)
    if (action) actions.set(action, (actions.get(action) ?? 0) + 1)
    if (dealsDamage(model)) weapons += 1
  }
  return {
    ranges: [...ranges].sort((a, b) => bandRank(a) - bandRank(b)),
    actions: [...actions].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([a]) => a),
    weapons: weapons > 0 && weapons < entities.length,
  }
}
