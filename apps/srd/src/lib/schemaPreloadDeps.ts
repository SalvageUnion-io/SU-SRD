/**
 * Per-schema preload lists — which `salvageunion-reference` schemas a given
 * `/schema/[schemaId]/` listing page or `/schema/[schemaId]/item/[itemId]/`
 * item page actually needs loaded client-side, instead of every island
 * calling `SalvageUnionReference.preload('all')` (the full ~1.3 MB corpus).
 *
 * This is deliberately conservative and coarse-grained (per audit advice):
 * cross-schema references in this dataset are pervasive, and a few are
 * unconditional — `ReferenceEntityCard` itself, regardless of the
 * entity's schema, always calls `resolveCardTable()` (-> `roll-tables`, for
 * `tableName` refs), always renders `RangeValueDisplay` for any `range`
 * DataValue (-> `distances`), and always resolves ability-tree prerequisite
 * text via `resolveClassRequirements` (-> `ability-tree-requirements`).
 * So trying to compute a minimal *per-item* closure is a correctness trap —
 * a missed edge silently drops content (some lookups warn-and-degrade) or
 * throws (LazyModel access on an unloaded schema throws synchronously, and
 * several of the "unconditional" lookups above go through LazyModel).
 * Instead this defines one small ALWAYS_CORE bundle every schema gets, plus
 * two shared "extra" bundles for schemas with further cross-references, all
 * verified by the render-equivalence test in
 * `__tests__/schemaPreloadDeps.test.tsx` (renders every entity of every
 * schema twice — once with the computed list, once with `'all'` — and
 * asserts identical markup). That test is what actually found ALWAYS_CORE's
 * members; treat this file as verified-by-test, not verified-by-reading.
 *
 * Evidence for each bundle (see also the test file for the enforcement):
 *
 * - ALWAYS_CORE — every `ReferenceEntityCard` render, regardless of
 *   schema, unconditionally touches:
 *   - `roll-tables`: `resolveCardTable()` (referenceEntity/card/) checks the
 *     entity's own `tableName` field — and its folded action's — via a
 *     LazyModel `.find()`.
 *   - `distances`: `RangeValueDisplay` resolves any `range`-type DataValue
 *     via a LazyModel lookup.
 *   - `ability-tree-requirements`: `resolveClassRequirements`
 *     (referenceEntity/card/entityCardTone.ts) resolves a hybrid class's
 *     prerequisite trees during render, via a LazyModel lookup keyed on the
 *     class name. This entry previously cited
 *     `extractReferenceEntityDetails` (referenceEntityDataExtraction.ts),
 *     which was deleted as dead — its only importer was its own test, and it
 *     had become a second, divergent implementation of this same lookup. The
 *     BUNDLE MEMBERSHIP IS UNCHANGED and still required: the live consumer
 *     reads the same schema, so dropping it here would throw on any class
 *     card.
 *   - `traits` / `keywords`: `[[trait]]` bracket refs in free text
 *     (`traits`), and structured `DataValue` entries of type `'trait'` /
 *     `'keyword'` (`DataValueDisplayView.tsx`, via `TraitKeywordDisplayView`).
 * - CONTENT_BUNDLE — every schema with its own `actions` field renders
 *   `ActionCard`, which needs `actions` (+ ALWAYS_CORE's `roll-tables`,
 *   already covered) resolved. `classes` entities additionally resolve
 *   their full ability tree via `ClassAbilityTree` ->
 *   `SalvageUnionReference.Abilities.all()` (unconditional LazyModel
 *   access), and `abilities` can `grant` equipment/npcs/vehicles
 *   (ReferenceEntityGrants). Simplest correct answer: give every
 *   CONTENT_BUNDLE schema the same shared list rather than a bespoke
 *   per-schema subset.
 * - CHASSIS_BUNDLE — `chassis` patterns embed systems/modules *by name*
 *   (useChassisPatternConfig -> `SalvageUnionReference.Systems.find` /
 *   `.Modules.find`, both LazyModel access) — needs those two schemas
 *   (themselves CONTENT_BUNDLE members, so also need `actions`). A chassis
 *   ability can also carry a `.drone` reference, resolved via
 *   `SalvageUnionReference.findIn('drones', ...)`
 *   (referenceEntity/card/resolveNestedEntities.ts). `factions` formation entries
 *   resolve to a full entity via `resolveFormationMember`
 *   (utilities.ts) — `member.schema` is one of a fixed, documented set
 *   (`chassis` default, or `vehicles`/`drones`/`squads`/`npcs`), each then
 *   run through `useChassisPatternConfig` too (ReferenceEntityFormation.tsx)
 *   — same bundle, not just `chassis` + `factions` themselves.
 * - `guides` steps reference an arbitrary schema chosen in the guide's own
 *   JSON data (`step.schema[0]`, resolved via
 *   `SalvageUnionReference.findAllIn(schemaName, ...)` in
 *   referenceEntity/card/resolveGuideSteps.ts) — this is the same
 *   "any route can render any cross-referenced entity" situation ADR-005
 *   describes for ITUN. Not safely narrowable; kept at `'all'`.
 * - Every other schema (no `actions` field, not chassis/classes/factions/
 *   guides) never reaches `ActionCard`/`ClassAbilityTree`/chassis-
 *   pattern resolution, so it only needs ALWAYS_CORE. => LEAF schemas.
 */

/** Every `ReferenceEntityCard` render touches these regardless of the
 *  entity's own schema — see file header. */
export const ALWAYS_CORE: readonly string[] = [
  'roll-tables',
  'distances',
  'ability-tree-requirements',
  'traits',
  'keywords',
]

/** Schemas with their own `actions` field, `classes` (ability-tree lookup),
 *  and everything `abilities` can `grant`. Shared bundle — see file header. */
export const CONTENT_BUNDLE: readonly string[] = [
  'abilities',
  'bio-titans',
  'classes',
  'crawlers',
  'creatures',
  'drones',
  'equipment',
  'meld',
  'modules',
  'npcs',
  'squads',
  'systems',
  'vehicles',
  'actions',
  ...ALWAYS_CORE,
]

/** `chassis` itself, and any schema that resolves a full Chassis entity
 *  (currently just `factions`, via formation rosters). See file header. */
export const CHASSIS_BUNDLE: readonly string[] = [
  'chassis',
  'systems',
  'modules',
  'drones',
  'vehicles',
  'squads',
  'npcs',
  'actions',
  ...ALWAYS_CORE,
]

/** `crawler-bays` — the Armament Bay's Weapons System choice is a schema-only
 *  catalog resolved at render time (`resolveCatalogChoiceEntities`): it reads
 *  the whole `systems` collection and filters by referenced-action damage type
 *  (`actions`). The resolver runs even for the collapsed listing (to count the
 *  options), so both schemas must be loaded whenever a bay renders. */
export const CRAWLER_BAY_BUNDLE: readonly string[] = ['systems', 'actions', ...ALWAYS_CORE]

/** Schemas whose entities are data-driven, arbitrary cross-references into
 *  any other schema (guide steps) — not safely narrowable. */
const ARBITRARY_SCHEMAS: ReadonlySet<string> = new Set(['guides'])

const SCHEMA_PRELOAD_DEPS: Readonly<Record<string, readonly string[]>> = {
  chassis: CHASSIS_BUNDLE,
  factions: CHASSIS_BUNDLE,
  abilities: CONTENT_BUNDLE,
  'bio-titans': CONTENT_BUNDLE,
  classes: CONTENT_BUNDLE,
  crawlers: CONTENT_BUNDLE,
  creatures: CONTENT_BUNDLE,
  drones: CONTENT_BUNDLE,
  equipment: CONTENT_BUNDLE,
  meld: CONTENT_BUNDLE,
  modules: CONTENT_BUNDLE,
  npcs: CONTENT_BUNDLE,
  squads: CONTENT_BUNDLE,
  systems: CONTENT_BUNDLE,
  vehicles: CONTENT_BUNDLE,
  // crawler-bays: resolves a Weapons System catalog (systems + actions).
  'crawler-bays': CRAWLER_BAY_BUNDLE,
  // Leaf schemas: ALWAYS_CORE only (see file header).
  'crawler-tech-levels': ALWAYS_CORE,
  distances: ALWAYS_CORE,
  keywords: ALWAYS_CORE,
  'roll-tables': ALWAYS_CORE,
  sources: ALWAYS_CORE,
  'tech-levels': ALWAYS_CORE,
  traits: ALWAYS_CORE,
}

/**
 * The list to pass to `SalvageUnionReference.preload(...)` (or `useGameData`
 * / `GameDataGate`'s `schemas` option) for a given `/schema/[schemaId]/`
 * route. Falls back to `'all'` for `guides` and any schema not covered above
 * (new schemas default to the safe, unoptimized behavior until added here).
 */
export function getSchemaPreloadList(schemaId: string): string[] | 'all' {
  if (ARBITRARY_SCHEMAS.has(schemaId)) return 'all'
  const deps = SCHEMA_PRELOAD_DEPS[schemaId]
  if (!deps) return 'all'
  return [...new Set([schemaId, ...deps])]
}
