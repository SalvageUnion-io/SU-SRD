/**
 * Generic abilities — the ones EVERY Pilot has, without spending a pick.
 *
 * The core book prints them under "Salvaging Abilities" (p.248-249) with the
 * flat statement "All Pilots have the following Abilities." They are the eight
 * Area Salvage / Mech Salvage / Scrap / Repair / Patch Up / Mount / Craft / Load
 * entries, carried in the dataset under `tree: 'Generic'`, `level: 'G'`.
 *
 * They are DERIVED, never stored on a pilot. Two independent reasons:
 *
 *   1. `pilot.abilities.length` is counted against `PILOT_CREATION_ABILITY_PICKS`
 *      (see `creation.ts`), so persisting the universal eight into that array
 *      would report every freshly-created pilot as eight picks over budget.
 *   2. `isLegalCreationAbility` admits only `level === 1` abilities whose tree is
 *      one of the class's core trees. 'Generic' is never a core tree and 'G' is
 *      never level 1, so these can't be *picked* — which is the schema already
 *      saying they aren't chosen.
 *
 * Consumers therefore fold `genericAbilities()` in at read time alongside the
 * pilot's learned abilities, rather than seeding them at creation.
 */

/** The dataset tree that holds the universal abilities. */
export const GENERIC_ABILITY_TREE = 'Generic'

/** The minimum shape needed to classify an ability as Generic. */
export type GenericAbilityInput = { tree: string }

/** Whether an ability is one every Pilot has by default. */
export function isGenericAbility(ability: GenericAbilityInput): boolean {
  return ability.tree === GENERIC_ABILITY_TREE
}

/**
 * The universal abilities, filtered out of a full ability list. Pure (takes the
 * list rather than reaching for the ORM) so it matches `legalCreationAbilities`
 * and stays callable without a preload.
 */
export function genericAbilities<T extends GenericAbilityInput>(abilities: readonly T[]): T[] {
  return abilities.filter(isGenericAbility)
}
