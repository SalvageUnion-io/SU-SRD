/**
 * Creation-legality predicates and pick budgets (Pilot Bay, Core Book
 * pp.18–19 — wizard-refresh plan §5.1).
 *
 * Pure predicates over NEUTRAL structural inputs only — entity records,
 * counts — in the style of capacity.ts (ADR-006). No React, no IndexedDB,
 * no app imports; a consumer's resolved reference records satisfy these
 * structural shapes automatically.
 *
 * Source scope note (plan Q12): predicates are Tech-Level/tree based and
 * deliberately allow all sources (core + expansions) — "Tech 1" and
 * "core tree" are the rules' own boundaries, source is not.
 */

/**
 * The ability shape creation legality reads (level 1–3 | 'L' | 'G' + tree).
 */
export type CreationAbilityInput = { level: number | string; tree: string }

/** The equipment shape creation legality reads. */
export type CreationEquipmentInput = { techLevel?: number | string }

/**
 * The neutral input for class legality: a class's core ability trees, or
 * `undefined` for a class that has none. Predicates take THIS array — the
 * value they actually read — rather than a class object, so a consumer's
 * (unioned) class record is narrowed to `coreTrees` at the call site and no
 * weak-type/union ambiguity ever reaches this module.
 */
export type CreationCoreTrees = readonly string[] | undefined

/**
 * A legal creation class is one of the six CORE classes — the classes with a
 * non-empty `coreTrees` field ("There are six core Pilot classes", p.18).
 * Advanced/Hybrid specialisations expose no core trees, so they never qualify.
 */
export function isLegalCreationClass(coreTrees: CreationCoreTrees): boolean {
  return Array.isArray(coreTrees) && coreTrees.length > 0
}

/**
 * A legal first ability is `level === 1` AND `tree ∈ coreTrees`
 * ("Your Pilot starts with 1 Ability of your choice", p.18). The core-tree
 * bound structurally excludes Generic ('G') and Legendary ('L') abilities and
 * the Level-1 entries of advanced/hybrid trees — those trees appear in no
 * class's `coreTrees`.
 */
export function isLegalCreationAbility(
  ability: CreationAbilityInput,
  coreTrees: CreationCoreTrees
): boolean {
  if (!isLegalCreationClass(coreTrees)) return false
  return ability.level === 1 && (coreTrees ?? []).includes(ability.tree)
}

/**
 * The legal first-ability pool for a class: its core trees' Level-1 abilities.
 * For the Salvager — coreTrees = all 15 core trees ("a 'jack of all trades'
 * Class, they can pick from any of the Core Ability trees", p.18) — this is
 * exactly the 15 core-tree Level-1 abilities, asserted by a unit test.
 */
export function legalCreationAbilities<T extends CreationAbilityInput>(
  abilities: readonly T[],
  coreTrees: CreationCoreTrees
): T[] {
  return abilities.filter((ability) => isLegalCreationAbility(ability, coreTrees))
}

/**
 * Legal starting equipment is Tech 1 ("You may choose two pieces of Tech 1
 * Pilot Equipment from the list", p.19).
 */
export function isLegalCreationEquipment(item: CreationEquipmentInput): boolean {
  return item.techLevel === 1
}

/** Starting ability picks: exactly 1 ("starts with 1 Ability", p.18). */
export const PILOT_CREATION_ABILITY_PICKS = 1

/** Starting equipment picks: exactly 2 ("two pieces of Tech 1", p.19). */
export const PILOT_CREATION_EQUIPMENT_PICKS = 2

/** Ability picks still owed (never negative). */
export function pilotAbilityPicksRemaining(selectedCount: number): number {
  return Math.max(0, PILOT_CREATION_ABILITY_PICKS - selectedCount)
}

/** Equipment picks still owed (never negative). */
export function pilotEquipmentPicksRemaining(selectedCount: number): number {
  return Math.max(0, PILOT_CREATION_EQUIPMENT_PICKS - selectedCount)
}

/** Exactly the budgeted ability picks — over-budget (a stale draft) is NOT complete. */
export function isPilotAbilityPickComplete(selectedCount: number): boolean {
  return selectedCount === PILOT_CREATION_ABILITY_PICKS
}

/** Exactly the budgeted equipment picks — over-budget is NOT complete. */
export function isPilotEquipmentPickComplete(selectedCount: number): boolean {
  return selectedCount === PILOT_CREATION_EQUIPMENT_PICKS
}
