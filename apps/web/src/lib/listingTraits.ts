import type { EntityModel, RefEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'

/**
 * The traits an entity carries, by name, as its card prints them (its own,
 * or its self-action's: a weapon system's Hot is its attack's). The keywords a
 * card mentions beside them (Range, Turn Action) are not traits.
 */
export function entityTraitNames(model: Pick<EntityModel, 'traits'>): string[] {
  return [
    ...new Set(
      model.traits.filter((trait) => trait.schemaName === 'traits').map((trait) => trait.name)
    ),
  ]
}

/**
 * The traits an entity carries as its card prints them, each with its value
 * ("Hot 3", "Uses 6"): what a listing's Traits column shows, since the value
 * is what decides between two parts (r5 E8). The filter picks by name alone
 * (`entityTraitNames`).
 */
export function entityTraitLabels(model: Pick<EntityModel, 'traits'>): string[] {
  return [
    ...new Set(
      model.traits
        .filter((trait) => trait.schemaName === 'traits')
        .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
    ),
  ]
}

/**
 * The traits a listing can be filtered by: every one some entity carries, by
 * name, where enough of them carry any to make a facet of it (a quarter, the
 * Ledger's own rule for a column). Else none.
 */
export function listingTraits(entities: readonly RefEntity[]): string[] {
  const names = new Set<string>()
  let carriers = 0
  for (const entity of entities) {
    const traits = entityTraitNames(toEntityModel(entity))
    if (traits.length > 0) carriers += 1
    for (const trait of traits) names.add(trait)
  }
  return carriers * 4 >= entities.length ? [...names].sort((a, b) => a.localeCompare(b)) : []
}
