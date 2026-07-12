/**
 * Creation-legality predicates and pick budgets (Pilot Bay pp.18–19 +
 * Mech Workshop pp.94–95 + Union Crawler pp.212–213 — wizard-refresh
 * plan §5.1).
 *
 * Pure predicates over NEUTRAL structural inputs only — the exact primitive
 * values a rule reads (numbers, arrays, strings) with REQUIRED fields — in
 * the style of capacity.ts (ADR-006). No React, no IndexedDB, no app
 * imports; a consumer narrows its resolved reference records to these
 * primitives at the call site, so no entity-union/weak-type ambiguity ever
 * reaches this module.
 *
 * Source scope note (plan Q12): predicates are Tech-Level/tree based and
 * deliberately allow all sources (core + expansions) — "Tech 1" and
 * "core tree" are the rules' own boundaries, source is not.
 */

import { scrapCostFor } from './scrap.js'

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

// ---------------------------------------------------------------------------
// Mech Workshop (Core Book pp.94–95 — wizard-refresh Phase 4)
// ---------------------------------------------------------------------------

/**
 * A legal creation chassis is Tech 1 ("Craft a Tech 1 Mech Chassis of your
 * choice from the Mech Chassis Blueprints list", p.94). Takes the primitive
 * the rule reads — a chassis record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1).
 */
export function isLegalCreationChassis(techLevel: number | string): boolean {
  return techLevel === 1
}

/**
 * A legal creation system is Tech 1 ("You now craft Tech 1 Systems from the
 * System Blueprints list", p.95).
 */
export function isLegalCreationSystem(techLevel: number | string): boolean {
  return techLevel === 1
}

/**
 * A legal creation module is Tech 1 ("you may craft Tech 1 Modules from the
 * Module Blueprints list", p.95).
 */
export function isLegalCreationModule(techLevel: number | string): boolean {
  return techLevel === 1
}

/**
 * The pattern shape starting legality reads: the STORED `legalStarting` data
 * tag (optional on the reference pattern records — absent means unflagged).
 * Used only as a generic constraint; the predicate itself takes the primitive.
 */
export type CreationPatternInput = { legalStarting?: boolean }

/**
 * A legal STARTING pattern carries the stored `legalStarting` data flag —
 * an explicit tag set only where the source book calls it out. NEVER
 * computed from tech level or salvage value (project data convention;
 * PR #292). Takes the primitive the rule reads — the record's
 * `legalStarting` value (undefined = unflagged = not legal starting).
 */
export function isLegalStartingPattern(legalStarting: boolean | undefined): boolean {
  return legalStarting === true
}

/** Filters a chassis's patterns down to the stored-`legalStarting` set. */
export function legalStartingPatterns<T extends CreationPatternInput>(patterns: readonly T[]): T[] {
  return patterns.filter((pattern) => isLegalStartingPattern(pattern.legalStarting))
}

/**
 * The whole starting budget: 20 Tech 1 Scrap for chassis + Systems + Modules
 * ("You start with 20 Tech 1 Scrap. You will use this Scrap to craft your
 * first Mech", p.94).
 */
export const MECH_CREATION_SCRAP_CAP = 20

/** One loadout line: an item's Salvage Value + how many copies are crafted. */
export type MechCreationLoadoutEntry = { sv: number; count: number }

export type MechCreationBudgetInput = {
  /** The chosen chassis's Salvage Value; 0 while no chassis is chosen. */
  chassisSV: number
  /** Installed systems + modules as (sv, count) lines. */
  loadout: readonly MechCreationLoadoutEntry[]
}

export type MechCreationBudget = {
  /** The 20-Scrap starting cap. */
  cap: number
  /** Tech 1 Scrap spent: chassis cost + Σ(item cost × count). */
  spent: number
  /** Scrap left (negative when an out-of-regime draft overspends). */
  remaining: number
  /** Whether one more copy of an item with this SV fits the remaining scrap. */
  perItemAffordable: (sv: number) => boolean
}

/**
 * The 20-Scrap creation economy (p.94), built on the canonical crafting cost
 * (`scrapCostFor` — cost equals Salvage Value): chassis + every installed
 * copy debit one shared pool; whatever remains banks to the Union Crawler.
 */
export function mechCreationBudget(input: MechCreationBudgetInput): MechCreationBudget {
  const spent =
    scrapCostFor({ salvageValue: input.chassisSV, techLevel: 1 }) +
    input.loadout.reduce(
      (sum, entry) => sum + scrapCostFor({ salvageValue: entry.sv, techLevel: 1 }) * entry.count,
      0
    )
  const remaining = MECH_CREATION_SCRAP_CAP - spent
  return {
    cap: MECH_CREATION_SCRAP_CAP,
    spent,
    remaining,
    perItemAffordable: (sv: number) => sv <= remaining,
  }
}

// ---------------------------------------------------------------------------
// Union Crawler (Core Book pp.212–213 — wizard-refresh Phase 5)
// ---------------------------------------------------------------------------

/**
 * A new Union Crawler's Tech Level is fixed ("A Tech 1 starting Union Crawler
 * is about the size of a small village", p.213 — creation always starts at
 * Tech Level 1, a Hamlet Crawler).
 */
export const CRAWLER_CREATION_TECH_LEVEL = 1

/**
 * A legal creation crawler weapon is a Tech 1 Weapons System ("To start, this
 * can be any Tech 1 Weapons System of the players' choice", p.213 — creation
 * is stricter than the in-play `TL ≤ crawler TL` rule). Takes the primitive
 * the rule reads — the system record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1). The caller separately filters
 * to WEAPONS systems (`isWeaponSystem`) — the Armament Bay holds nothing else.
 */
export function isLegalCreationCrawlerWeapon(techLevel: number | string): boolean {
  return techLevel === CRAWLER_CREATION_TECH_LEVEL
}

/**
 * The neutral mutation line a crawler type's stored `mutations` rows carry —
 * the exact values these rules read (a discriminator string + a number), NOT
 * the whole SURef crawler record. A consumer narrows its resolved type record
 * to `mutations` at the call site.
 */
export type CrawlerMutationInput = { type: string; value: number }

/**
 * Armament-Bay weapon slots for a crawler type: base 1 ("A Union Crawler can
 * mount a single Weapons System in its Armament Bay", p.213) plus any
 * `weapon_slots` mutations — the STORED data flag on the type record (the
 * Battle Crawler's "Improved Armour and Armaments" grants +1, p.216). Never
 * derived from action-name string matching.
 */
export function crawlerWeaponSlots(mutations: readonly CrawlerMutationInput[] | undefined): number {
  const bonus = (mutations ?? [])
    .filter((m) => m.type === 'weapon_slots')
    .reduce((sum, m) => sum + m.value, 0)
  return 1 + bonus
}

/**
 * Max-SP bonus for a crawler type: the sum of its stored `max_sp_bonus`
 * mutations (the Battle Crawler's +5 Max SP, p.216). Applied AT READ by
 * `crawlerMaxSP` — the stored crawler record keeps the BARE tech-level value,
 * so type swaps re-derive correctly in both directions.
 */
export function crawlerMaxSpBonus(mutations: readonly CrawlerMutationInput[] | undefined): number {
  return (mutations ?? [])
    .filter((m) => m.type === 'max_sp_bonus')
    .reduce((sum, m) => sum + m.value, 0)
}

/**
 * Minimum Armament-Bay weapons at creation: the book's step 3 mounts one
 * ("Choose your Weapons System … A Union Crawler can mount a single Weapons
 * System in its Armament Bay", p.213) — a guided crawler never ships unarmed.
 */
export const CRAWLER_CREATION_MIN_WEAPONS = 1

/** Whether the creation weapon pick satisfies the minimum-1 mount (p.213). */
export function isCrawlerWeaponPickComplete(selectedCount: number): boolean {
  return selectedCount >= CRAWLER_CREATION_MIN_WEAPONS
}
