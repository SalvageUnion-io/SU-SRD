/**
 * Creation-legality predicates and pick budgets (Pilot Bay pp.18–19 +
 * Mech Workshop pp.94–95 + Union Crawler pp.212–213).
 *
 * Pure predicates over NEUTRAL structural inputs only — the exact primitive
 * values a rule reads (numbers, arrays, strings) with REQUIRED fields — in
 * the style of capacity.ts (ADR-006). No React, no IndexedDB, no app
 * imports; a consumer narrows its resolved reference records to these
 * primitives at the call site, so no entity-union/weak-type ambiguity ever
 * reaches this module.
 *
 * Source scope note: predicates are Tech-Level/tree based and
 * deliberately allow all sources (core + expansions) — "Tech 1" and
 * "core tree" are the rules' own boundaries, source is not.
 */
/**
 * The ability shape creation legality reads (level 1–3 | 'L' | 'G' + tree).
 */
export type CreationAbilityInput = {
    level: number | string;
    tree: string;
};
/** The equipment shape creation legality reads. */
export type CreationEquipmentInput = {
    techLevel?: number | string;
};
/**
 * The neutral input for class legality: a class's core ability trees, or
 * `undefined` for a class that has none. Predicates take THIS array — the
 * value they actually read — rather than a class object, so a consumer's
 * (unioned) class record is narrowed to `coreTrees` at the call site and no
 * weak-type/union ambiguity ever reaches this module.
 */
export type CreationCoreTrees = readonly string[] | undefined;
/**
 * A legal creation class is one of the six CORE classes — the classes with a
 * non-empty `coreTrees` field ("There are six core Pilot classes", p.18).
 * Advanced/Hybrid specialisations expose no core trees, so they never qualify.
 */
export declare function isLegalCreationClass(coreTrees: CreationCoreTrees): boolean;
/**
 * A legal first ability is `level === 1` AND `tree ∈ coreTrees`
 * ("Your Pilot starts with 1 Ability of your choice", p.18). The core-tree
 * bound structurally excludes Generic ('G') and Legendary ('L') abilities and
 * the Level-1 entries of advanced/hybrid trees — those trees appear in no
 * class's `coreTrees`.
 */
export declare function isLegalCreationAbility(ability: CreationAbilityInput, coreTrees: CreationCoreTrees): boolean;
/**
 * The legal first-ability pool for a class: its core trees' Level-1 abilities.
 * For the Salvager — coreTrees = all 15 core trees ("a 'jack of all trades'
 * Class, they can pick from any of the Core Ability trees", p.18) — this is
 * exactly the 15 core-tree Level-1 abilities, asserted by a unit test.
 */
export declare function legalCreationAbilities<T extends CreationAbilityInput>(abilities: readonly T[], coreTrees: CreationCoreTrees): T[];
/**
 * Legal starting equipment is Tech 1 ("You may choose two pieces of Tech 1
 * Pilot Equipment from the list", p.19).
 */
export declare function isLegalCreationEquipment(item: CreationEquipmentInput): boolean;
/** Starting ability picks: exactly 1 ("starts with 1 Ability", p.18). */
export declare const PILOT_CREATION_ABILITY_PICKS = 1;
/** Starting equipment picks: exactly 2 ("two pieces of Tech 1", p.19). */
export declare const PILOT_CREATION_EQUIPMENT_PICKS = 2;
/** Equipment picks still owed (never negative). */
export declare function pilotEquipmentPicksRemaining(selectedCount: number): number;
/** Exactly the budgeted ability picks — over-budget (a stale draft) is NOT complete. */
export declare function isPilotAbilityPickComplete(selectedCount: number): boolean;
/** Exactly the budgeted equipment picks — over-budget is NOT complete. */
export declare function isPilotEquipmentPickComplete(selectedCount: number): boolean;
/**
 * A legal creation chassis is Tech 1 ("Craft a Tech 1 Mech Chassis of your
 * choice from the Mech Chassis Blueprints list", p.94). Takes the primitive
 * the rule reads — a chassis record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1).
 */
export declare function isLegalCreationChassis(techLevel: number | string): boolean;
/**
 * A legal creation system is Tech 1 ("You now craft Tech 1 Systems from the
 * System Blueprints list", p.95).
 */
export declare function isLegalCreationSystem(techLevel: number | string): boolean;
/**
 * A legal creation module is Tech 1 ("you may craft Tech 1 Modules from the
 * Module Blueprints list", p.95).
 */
export declare function isLegalCreationModule(techLevel: number | string): boolean;
/**
 * The pattern shape starting legality reads: the STORED `legalStarting` data
 * tag (optional on the reference pattern records — absent means unflagged).
 * Used only as a generic constraint; the predicate itself takes the primitive.
 */
export type CreationPatternInput = {
    legalStarting?: boolean;
};
/**
 * A legal STARTING pattern carries the stored `legalStarting` data flag —
 * an explicit tag set only where the source book calls it out. NEVER
 * computed from tech level or salvage value (project data convention).
 * Takes the primitive the rule reads — the record's
 * `legalStarting` value (undefined = unflagged = not legal starting).
 */
export declare function isLegalStartingPattern(legalStarting: boolean | undefined): boolean;
/** Filters a chassis's patterns down to the stored-`legalStarting` set. */
export declare function legalStartingPatterns<T extends CreationPatternInput>(patterns: readonly T[]): T[];
/**
 * The whole starting budget: 20 Tech 1 Scrap for chassis + Systems + Modules
 * ("You start with 20 Tech 1 Scrap. You will use this Scrap to craft your
 * first Mech", p.94).
 */
export declare const MECH_CREATION_SCRAP_CAP = 20;
/** One loadout line: an item's Salvage Value + how many copies are crafted. */
export type MechCreationLoadoutEntry = {
    sv: number;
    count: number;
};
export type MechCreationBudgetInput = {
    /** The chosen chassis's Salvage Value; 0 while no chassis is chosen. */
    chassisSV: number;
    /** Installed systems + modules as (sv, count) lines. */
    loadout: readonly MechCreationLoadoutEntry[];
};
export type MechCreationBudget = {
    /** The 20-Scrap starting cap. */
    cap: number;
    /** Tech 1 Scrap spent: chassis cost + Σ(item cost × count). */
    spent: number;
    /** Scrap left (negative when an out-of-regime draft overspends). */
    remaining: number;
    /** Whether one more copy of an item with this SV fits the remaining scrap. */
    perItemAffordable: (sv: number) => boolean;
};
/**
 * The 20-Scrap creation economy (p.94), built on the canonical crafting cost
 * (`scrapCostFor` — cost equals Salvage Value): chassis + every installed
 * copy debit one shared pool; whatever remains banks to the Union Crawler.
 */
export declare function mechCreationBudget(input: MechCreationBudgetInput): MechCreationBudget;
/**
 * A new Union Crawler's Tech Level is fixed ("A Tech 1 starting Union Crawler
 * is about the size of a small village", p.213 — creation always starts at
 * Tech Level 1, a Hamlet Crawler).
 */
export declare const CRAWLER_CREATION_TECH_LEVEL = 1;
/**
 * A legal creation crawler weapon is a Tech 1 Weapons System ("To start, this
 * can be any Tech 1 Weapons System of the players' choice", p.213 — creation
 * is stricter than the in-play `TL ≤ crawler TL` rule). Takes the primitive
 * the rule reads — the system record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1). The caller separately filters
 * to WEAPONS systems (`isWeaponSystem`) — the Armament Bay holds nothing else.
 */
export declare function isLegalCreationCrawlerWeapon(techLevel: number | string): boolean;
/**
 * The neutral mutation line a crawler type's stored `mutations` rows carry —
 * the exact values these rules read (a discriminator string + a number), NOT
 * the whole reference crawler record. A consumer narrows its resolved type record
 * to `mutations` at the call site.
 */
export type CrawlerMutationInput = {
    type: string;
    value: number;
};
/**
 * Armament-Bay weapon slots for a crawler type: base 1 ("A Union Crawler can
 * mount a single Weapons System in its Armament Bay", p.213) plus any
 * `weapon_slots` mutations — the STORED data flag on the type record (the
 * Battle Crawler's "Improved Armour and Armaments" grants +1, p.216). Never
 * derived from action-name string matching.
 */
export declare function crawlerWeaponSlots(mutations: readonly CrawlerMutationInput[] | undefined): number;
/**
 * Max-SP bonus for a crawler type: the sum of its stored `max_sp_bonus`
 * mutations (the Battle Crawler's +5 Max SP, p.216). Applied AT READ by
 * `crawlerMaxSP` — the stored crawler record keeps the BARE tech-level value,
 * so type swaps re-derive correctly in both directions.
 */
export declare function crawlerMaxSpBonus(mutations: readonly CrawlerMutationInput[] | undefined): number;
/**
 * Minimum Armament-Bay weapons at creation: the book's step 3 mounts one
 * ("Choose your Weapons System … A Union Crawler can mount a single Weapons
 * System in its Armament Bay", p.213) — a guided crawler never ships unarmed.
 */
export declare const CRAWLER_CREATION_MIN_WEAPONS = 1;
/** Whether the creation weapon pick satisfies the minimum-1 mount (p.213). */
export declare function isCrawlerWeaponPickComplete(selectedCount: number): boolean;
