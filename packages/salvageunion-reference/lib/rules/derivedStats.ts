/**
 * Derived maxima for all three entities (plan 2.5, gap 11).
 *
 * "Many maxima are derived, not fixed" (rules digest): store modifiers,
 * compute totals. This module is the single source for those computations —
 * it replaces the old PILOT_MAX_HP/PILOT_MAX_AP constants (lib/pilotStats.ts)
 * and the crawler SP slug-regex previously local to CrawlerSheet.
 *
 *   Pilot:   maxHP = 10 + maxHpModifier − Σ(minor injury: 1, major: 2)
 *            maxAP = 5 + maxApModifier
 *   Mech:    max{SP,EP,Heat,Cargo} = chassis stat + max*Modifier
 *   Crawler: maxSP = tech-level structurePoints (ORM) + the chosen TYPE's
 *            `max_sp_bonus` mutations (Battle +5, applied at read —
 *            wizard-refresh Phase 5) + maxSpModifier (a pure hand-edit)
 *
 * All functions are pure — no side effects, no async, no React. Parameter
 * types are small structural shapes (not full persisted records) — a
 * consumer's Zod-inferred Pilot/Mech/Crawler types (e.g. ITUN's
 * `src/lib/schemas/`) satisfy them automatically.
 */

import { SalvageUnionReference } from '../index.js'
import { crawlerMaxSpBonus } from './creation.js'
import { resolveChassisRef } from './resolveRefs.js'
import { abilityContributions, installedContributions, sumContributions } from './contributions.js'
import type { ActiveEffects } from './contributions.js'
import type { ResolvedContribution } from './contributions.js'

// ---------------------------------------------------------------------------
// Pilot
// ---------------------------------------------------------------------------

/**
 * Base pilot stats per the core rules (10 HP / 5 AP / 6 inventory slots).
 * These are NOT in the reference data — class records do not encode them —
 * so they live here as the named baseline the derivations build on.
 */
export const PILOT_BASE_HP = 10
export const PILOT_BASE_AP = 5
export const PILOT_BASE_INVENTORY_SLOTS = 6

/** A single pilot injury (rules A11): minor −1 max HP, major −2. */
type Injury = { severity: 'minor' | 'major'; note: string }

type PilotDerivationInput = {
  /** Ability refs the pilot holds — the source of ability contributions (ADR-029). */
  abilities?: string[]
  injuries?: Injury[]
  maxHpModifier?: number
  maxApModifier?: number
  maxInventorySlotsModifier?: number
  maxHpOverride?: number
  maxApOverride?: number
  maxInventorySlotsOverride?: number
}

/** Total max-HP penalty from injuries: minor −1, major −2 (rules A2/A11). */
export function injuryMaxHpPenalty(injuries: Injury[] | undefined): number {
  return (injuries ?? []).reduce((sum, injury) => sum + (injury.severity === 'major' ? 2 : 1), 0)
}

/**
 * Derived max HP. Can legitimately reach 0 or below — that is the dead state
 * (rules A2: "if Max HP reaches 0 the Pilot dies") and is surfaced by
 * isPilotDead(), not clamped away here.
 */
export function pilotMaxHPParts(pilot: PilotDerivationInput): StatBreakdown {
  // The injury penalty rides in `installed` — it is a rules-sourced contribution
  // like an installed statBonus, just a negative one, and is derived from
  // `injuries` so healing restores max HP with no bookkeeping.
  const hpSources = abilityContributions(pilot.abilities, 'pilot', 'maxHp')
  const abilityHp = sumContributions(hpSources)
  const parts = breakdownOf(
    PILOT_BASE_HP,
    -injuryMaxHpPenalty(pilot.injuries),
    pilot.maxHpModifier ?? 0,
    pilot.maxHpOverride,
    hpSources
  )
  // Max HP may legitimately reach 0 or below — that is the dead state
  // (rules A2), surfaced by isPilotDead() rather than clamped away. Recompute
  // unfloored so a lethal injury total is not hidden behind breakdownOf's floor.
  if (parts.overridden) return parts
  const unfloored =
    PILOT_BASE_HP + (pilot.maxHpModifier ?? 0) - injuryMaxHpPenalty(pilot.injuries) + abilityHp
  return { ...parts, derived: unfloored, total: unfloored }
}

export function pilotMaxHP(pilot: PilotDerivationInput): number {
  return pilotMaxHPParts(pilot).total
}

/** Derived max AP (base 5 + Stat Training tiers etc.). */
export function pilotMaxAPParts(pilot: PilotDerivationInput): StatBreakdown {
  return breakdownOf(
    PILOT_BASE_AP,
    0,
    pilot.maxApModifier ?? 0,
    pilot.maxApOverride,
    abilityContributions(pilot.abilities, 'pilot', 'maxAp')
  )
}

export function pilotMaxAP(pilot: PilotDerivationInput): number {
  return pilotMaxAPParts(pilot).total
}

/**
 * Derived pilot inventory capacity (rules A13: 6 base) + the hand-edited
 * `maxInventorySlotsModifier` + ability contributions (Beefcake +4), with the
 * same absolute `maxInventorySlotsOverride` pin HP and AP already honour.
 *
 * This lived in the ITUN sheet as a bare number with no provenance and no
 * override path, which meant `maxInventorySlotsOverride` — a field that has been
 * in ITUN's persisted Pilot schema all along — was read by nothing: a Free-Edit
 * pin wrote a value the gauge then ignored. Deriving it here, through the same
 * `breakdownOf` as every other maximum, is what makes the pin take effect and
 * gives the provenance panel a per-ability line instead of an anonymous total.
 */
export function pilotMaxInventorySlotsParts(pilot: PilotDerivationInput): StatBreakdown {
  return breakdownOf(
    PILOT_BASE_INVENTORY_SLOTS,
    0,
    pilot.maxInventorySlotsModifier ?? 0,
    pilot.maxInventorySlotsOverride,
    abilityContributions(pilot.abilities, 'pilot', 'inventorySlots')
  )
}

export function pilotMaxInventorySlots(pilot: PilotDerivationInput): number {
  return pilotMaxInventorySlotsParts(pilot).total
}

/** Dead-state check: derived max HP ≤ 0 means the pilot is dead. */
export function isPilotDead(pilot: PilotDerivationInput): boolean {
  return pilotMaxHP(pilot) <= 0
}

/**
 * Clamp current HP/AP to the derived maxima (floor 0). Run on every recompute
 * — e.g. after an injury is added or a modifier edited — and persist the
 * returned patch when non-empty.
 */
export function clampPilotCurrentStats(
  pilot: PilotDerivationInput & { currentHP?: number; currentAP?: number }
): Partial<{ currentHP: number; currentAP: number }> {
  const patch: Partial<{ currentHP: number; currentAP: number }> = {}
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  if (pilot.currentHP !== undefined && pilot.currentHP > maxHP) {
    patch.currentHP = maxHP
  }
  if (pilot.currentAP !== undefined && pilot.currentAP > maxAP) {
    patch.currentAP = maxAP
  }
  return patch
}

// ---------------------------------------------------------------------------
// Mech
// ---------------------------------------------------------------------------

/** The chassis stats the mech derivations need (resolved from the ORM by ref). */
export type ChassisStats = {
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  cargoCapacity?: number
  /** Slot counts — read by `fromStat` contributions (Hull Magnetiser). */
  systemSlots?: number
  moduleSlots?: number
}

type MechDerivationInput = {
  chassisRef: string
  maxSpModifier?: number
  maxEpModifier?: number
  maxHeatModifier?: number
  maxCargoModifier?: number
  maxSpOverride?: number
  maxEpOverride?: number
  maxHeatOverride?: number
  maxCargoOverride?: number
  // Optional so the legacy single-arg call form (e.g. tests, cargo cap) still
  // compiles; absent means "no installed bonuses to sum" and the derivation
  // falls back to chassis stat + modifier.
  systems?: string[]
  modules?: string[]
}

/**
 * The pilot whose abilities contribute to the mech they are piloting.
 *
 * Beefcake is a PILOT ability that raises the piloted MECH's Max SP and Cargo,
 * so a mech's maxima cannot be derived from the mech alone. Optional: a mech
 * with no pilot in scope simply gets no ability contributions, which is what an
 * unlinked mech should show.
 */
export type PilotingContext = {
  abilities?: string[]
  /** The mech's Tech Level, for `perTechLevel` amounts (Beefcake's 3+X). */
  techLevel?: number
  /**
   * Which `duration: 'activated'` contributions are switched on right now
   * (F1). Ephemeral play state, never persisted — an activated effect that is
   * off contributes nothing, exactly as if it were absent.
   */
  active?: ActiveEffects
}

/**
 * How a derived maximum was arrived at (ADR-029).
 *
 * `derived` is what the rules produce: base + installed bonuses + the player's
 * manual adjustment, floored at 0. `override` is an absolute Free-Edit pin
 * (ADR-022 amendment); when set it REPLACES the derived value rather than
 * adding to it, and `derived` is retained so the sheet can render an
 * "overridden from N" callout and revert to it.
 *
 * `total` is what a surface should display.
 */
export type StatBreakdown = {
  /** The rules baseline before anything is added (chassis stat, tech-level SP, a constant). */
  base: number
  /**
   * An ANONYMOUS rules-sourced addend — one aggregate line in the provenance
   * panel, with no per-item attribution. Two stats still use it: the pilot's
   * injury penalty (a negative contribution derived from `injuries`) and the
   * crawler's type `max_sp_bonus`.
   *
   * Installed systems/modules used to land here too, as a summed `statBonus`.
   * They are `contributions` now and so arrive through `sources`, per item and
   * by name ("Heat Sink +1") rather than as an unattributed lump.
   */
  installed: number
  /**
   * Contributions that know their own source (ADR-029) — an ability, by name.
   * Rendered as one labelled line each, so "Beefcake +7" is never mislabelled as
   * installed hardware.
   */
  sources: ResolvedContribution[]
  /** The player's hand-entered manual adjustment (`max*Modifier`). Contributes; never replaces. */
  adjustment: number
  /** base + installed + adjustment, floored at 0. Always computed, even when pinned. */
  derived: number
  /** The absolute pin, when the player set one. */
  override?: number
  /** What to display: the pin when pinned, else `derived`. */
  total: number
  /** True when a pin is in effect. */
  overridden: boolean
}

/** Assemble a breakdown, applying the pin last so `derived` is always retained. */
function breakdownOf(
  base: number,
  installed: number,
  adjustment: number,
  override?: number,
  sources: ResolvedContribution[] = []
): StatBreakdown {
  const derived = Math.max(0, base + installed + sumContributions(sources) + adjustment)
  const overridden = typeof override === 'number'
  return {
    base,
    installed,
    sources,
    adjustment,
    derived,
    ...(overridden ? { override } : {}),
    total: overridden ? Math.max(0, override) : derived,
    overridden,
  }
}

function resolveChassis(mech: MechDerivationInput, chassis?: ChassisStats | null): ChassisStats {
  return chassis ?? resolveChassisRef(mech.chassisRef) ?? {}
}

/**
 * Derived mech maxima: chassis stat + hand-edited modifier + every declared
 * `contribution` from the pilot's abilities and the mech's installed
 * systems/modules (heat sinks, capacitance banks, holds — rules B2/B4/B6/B14),
 * each counted per installed copy and attributed by name. Pass a pre-resolved
 * `chassis` to avoid repeated ORM lookups; floored at 0 so a negative total
 * never produces a negative maximum.
 *
 * There used to be a second, parallel encoding — a flat per-copy `statBonus`
 * map summed by `installedStatBonus` and added ALONGSIDE `installedContributions`
 * for the same stat. Nothing carried both, so nothing was double-counted; but
 * one record authored with both would have been, silently, and the parity
 * validator's `hasCapData` (an OR) could not tell that record from a correct
 * one. `statBonus` is gone: `contributions` is the only numeric encoding, and
 * `validateParityLogic` now fails on any record that re-introduces a second.
 */
export function mechMaxSPParts(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): StatBreakdown {
  const c = resolveChassis(mech, chassis)
  return breakdownOf(c.structurePoints ?? 0, 0, mech.maxSpModifier ?? 0, mech.maxSpOverride, [
    ...abilityContributions(
      pilot?.abilities,
      'pilotedMech',
      'structurePoints',
      pilot?.techLevel,
      pilot?.active
    ),
    ...installedContributions(
      [...(mech.systems ?? []), ...(mech.modules ?? [])],
      'structurePoints',
      {
        techLevel: pilot?.techLevel,
        active: pilot?.active,
        stats: { systemSlots: c.systemSlots ?? 0, moduleSlots: c.moduleSlots ?? 0 },
      }
    ),
  ])
}

export function mechMaxEPParts(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): StatBreakdown {
  const c = resolveChassis(mech, chassis)
  return breakdownOf(c.energyPoints ?? 0, 0, mech.maxEpModifier ?? 0, mech.maxEpOverride, [
    ...abilityContributions(
      pilot?.abilities,
      'pilotedMech',
      'energyPoints',
      pilot?.techLevel,
      pilot?.active
    ),
    ...installedContributions([...(mech.systems ?? []), ...(mech.modules ?? [])], 'energyPoints', {
      techLevel: pilot?.techLevel,
      active: pilot?.active,
      stats: { systemSlots: c.systemSlots ?? 0, moduleSlots: c.moduleSlots ?? 0 },
    }),
  ])
}

export function mechMaxHeatParts(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): StatBreakdown {
  const c = resolveChassis(mech, chassis)
  return breakdownOf(c.heatCapacity ?? 0, 0, mech.maxHeatModifier ?? 0, mech.maxHeatOverride, [
    ...abilityContributions(
      pilot?.abilities,
      'pilotedMech',
      'heatCapacity',
      pilot?.techLevel,
      pilot?.active
    ),
    ...installedContributions([...(mech.systems ?? []), ...(mech.modules ?? [])], 'heatCapacity', {
      techLevel: pilot?.techLevel,
      active: pilot?.active,
      stats: { systemSlots: c.systemSlots ?? 0, moduleSlots: c.moduleSlots ?? 0 },
    }),
  ])
}

export function mechMaxCargoParts(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): StatBreakdown {
  const c = resolveChassis(mech, chassis)
  return breakdownOf(c.cargoCapacity ?? 0, 0, mech.maxCargoModifier ?? 0, mech.maxCargoOverride, [
    ...abilityContributions(
      pilot?.abilities,
      'pilotedMech',
      'cargoCapacity',
      pilot?.techLevel,
      pilot?.active
    ),
    ...installedContributions([...(mech.systems ?? []), ...(mech.modules ?? [])], 'cargoCapacity', {
      techLevel: pilot?.techLevel,
      active: pilot?.active,
      stats: { systemSlots: c.systemSlots ?? 0, moduleSlots: c.moduleSlots ?? 0 },
    }),
  ])
}

// The scalar forms every existing call site uses. Thin `.total` wrappers so the
// breakdown could be introduced without touching ~40 callers (ADR-029).
export function mechMaxSP(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): number {
  return mechMaxSPParts(mech, chassis, pilot).total
}

export function mechMaxEP(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): number {
  return mechMaxEPParts(mech, chassis, pilot).total
}

export function mechMaxHeat(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): number {
  return mechMaxHeatParts(mech, chassis, pilot).total
}

export function mechMaxCargo(
  mech: MechDerivationInput,
  chassis?: ChassisStats | null,
  pilot?: PilotingContext
): number {
  return mechMaxCargoParts(mech, chassis, pilot).total
}

/**
 * Clamp current SP/EP/Heat to the derived maxima. Run after any modifier or
 * chassis change and persist the returned patch when non-empty.
 * (Cargo is a slot count, not a current/max pair — over-capacity cargo is
 * displayed honestly, never clamped, per design §2.12.)
 */
export function clampMechCurrentStats(
  mech: MechDerivationInput & { currentSP?: number; currentEP?: number; currentHeat?: number },
  chassis?: ChassisStats | null
): Partial<{ currentSP: number; currentEP: number; currentHeat: number }> {
  const c = resolveChassis(mech, chassis)
  const patch: Partial<{ currentSP: number; currentEP: number; currentHeat: number }> = {}
  if (mech.currentSP !== undefined && mech.currentSP > mechMaxSP(mech, c)) {
    patch.currentSP = mechMaxSP(mech, c)
  }
  if (mech.currentEP !== undefined && mech.currentEP > mechMaxEP(mech, c)) {
    patch.currentEP = mechMaxEP(mech, c)
  }
  if (mech.currentHeat !== undefined && mech.currentHeat > mechMaxHeat(mech, c)) {
    patch.currentHeat = mechMaxHeat(mech, c)
  }
  return patch
}

/**
 * The unified read-time conditions vocabulary for a mech (plan 2.3): the
 * free-form `conditions[]` merged with the automation-written boolean flags
 * (shutdown → 'Shutdown', vulnerable → 'Vulnerable', destroyed → 'Destroyed'),
 * deduplicated case-insensitively. Display layers render THIS list so the
 * two storage forms never disagree on screen.
 */
export function unifiedMechConditions(mech: {
  conditions: string[]
  shutdown?: boolean
  vulnerable?: boolean
  destroyed?: boolean
}): string[] {
  const merged = [...mech.conditions]
  const has = (label: string) => merged.some((c) => c.toLowerCase() === label.toLowerCase())
  if (mech.shutdown && !has('Shutdown')) merged.push('Shutdown')
  if (mech.vulnerable && !has('Vulnerable')) merged.push('Vulnerable')
  if (mech.destroyed && !has('Destroyed')) merged.push('Destroyed')
  return merged
}

// ---------------------------------------------------------------------------
// Crawler
// ---------------------------------------------------------------------------

type CrawlerDerivationInput = {
  techLevel: string
  maxSpOverride?: number
  /**
   * Chosen crawler-type ref (SRD id OR name) — the type's stored
   * `max_sp_bonus` mutations (Battle +5) apply AT READ, so the record keeps
   * the BARE tech-level value and type swaps re-derive in both directions
   * (wizard-refresh Phase 5). Absent/unresolvable = no type bonus.
   */
  type?: string
  maxSpModifier?: number
}

/**
 * Parse a crawler techLevel slug (e.g. "tech-3") to its numeric level (3).
 * Returns undefined when no digits are present.
 *
 * A duplicate of ITUN's `src/lib/crawlerLevel.ts#parseCrawlerTechLevel` — kept
 * local rather than imported so this module has no dependency on an ITUN app
 * file. `crawlerLevel.ts` also owns `resolveEffectiveCrawlerLevel`, which
 * depends on ITUN's Pilot/Crawler Zod types and is out of this migration's
 * scope (only this module's own rules functions were being relocated).
 */
function parseCrawlerTechLevel(techLevel: string): number | undefined {
  const digits = techLevel.replace(/[^0-9]/g, '')
  if (digits.length === 0) {
    return undefined
  }
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * The type's stored `max_sp_bonus` mutations, resolved by id-or-name (the
 * same tolerance as bay refs). Salvage-tolerant: a missing `crawlers` catalog
 * (not yet preloaded) or an unresolvable ref contributes 0 rather than
 * throwing.
 */
function crawlerTypeMaxSpBonus(typeRef: string | undefined): number {
  if (!typeRef) return 0
  try {
    // id-then-name via the model's indexes. Equivalent to the linear OR-scan
    // this replaced — see BaseModel.indexes.test.ts, which verifies the
    // id-first tie-break resolves every key exactly as data order did.
    const type =
      SalvageUnionReference.Crawlers.getById(typeRef) ??
      SalvageUnionReference.Crawlers.getByName(typeRef)
    return crawlerMaxSpBonus(type?.mutations)
  } catch {
    return 0
  }
}

/** The additive parts of a crawler's derived max SP (and their total). */
export type CrawlerMaxSPParts = StatBreakdown & {
  /**
   * The chosen type's `max_sp_bonus` mutations, applied at read (Battle +5).
   * A named alias for `installed` — this stat's only rules-sourced contribution
   * — kept because the wizard's SP breakdown copy reads it by name.
   */
  typeBonus: number
}

/**
 * Derived crawler max SP, decomposed: the tech level's structurePoints from
 * the reference ORM, plus the chosen TYPE's stored `max_sp_bonus` mutations
 * applied AT READ (Battle Crawler +5 — the record stores the BARE tech-level
 * value, so type swaps re-derive correctly both ways), plus the hand-edited
 * maxSpModifier. Base resolves to 0 when the techLevel slug cannot be parsed
 * — the caller should surface that as a data problem rather than rendering a
 * silent 0-pip track.
 */
export function crawlerMaxSPParts(crawler: CrawlerDerivationInput): CrawlerMaxSPParts {
  const tl = parseCrawlerTechLevel(crawler.techLevel)
  const base =
    tl === undefined
      ? 0
      : (SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === tl)?.structurePoints ??
        0)
  const typeBonus = crawlerTypeMaxSpBonus(crawler.type)
  const modifier = crawler.maxSpModifier ?? 0
  const parts = breakdownOf(base, typeBonus, modifier, crawler.maxSpOverride)
  // `typeBonus` is this stat's rules-sourced contribution, so it maps onto
  // `installed`; the named alias is kept for the wizard's SP breakdown copy.
  return { ...parts, typeBonus }
}

/** Derived crawler max SP — `crawlerMaxSPParts(crawler).total`. */
export function crawlerMaxSP(crawler: CrawlerDerivationInput): number {
  return crawlerMaxSPParts(crawler).total
}

/**
 * Clamp current SP to the derived max. Persist the returned patch when
 * non-empty (e.g. after editing maxSpModifier or downgrading tech level).
 */
export function clampCrawlerCurrentStats(
  crawler: CrawlerDerivationInput & { currentSP?: number }
): Partial<{ currentSP: number }> {
  const maxSP = crawlerMaxSP(crawler)
  if (crawler.currentSP !== undefined && crawler.currentSP > maxSP) {
    return { currentSP: maxSP }
  }
  return {}
}
