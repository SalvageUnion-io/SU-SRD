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
 *   Crawler: maxSP = tech-level structurePoints (ORM) + maxSpModifier
 *            (Battle Crawler +5 is hand-set into maxSpModifier)
 *
 * All functions are pure — no side effects, no async, no React.
 */

import { SalvageUnionReference } from 'salvageunion-reference'

import { parseCrawlerTechLevel } from '../crawlerLevel'
import type { Crawler } from '../schemas/crawler'
import type { Mech } from '../schemas/mech'
import type { Pilot } from '../schemas/pilot'

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

type PilotDerivationInput = Pick<Pilot, 'injuries' | 'maxHpModifier' | 'maxApModifier'>

/** Total max-HP penalty from injuries: minor −1, major −2 (rules A2/A11). */
export function injuryMaxHpPenalty(injuries: Pilot['injuries']): number {
  return (injuries ?? []).reduce((sum, injury) => sum + (injury.severity === 'major' ? 2 : 1), 0)
}

/**
 * Derived max HP. Can legitimately reach 0 or below — that is the dead state
 * (rules A2: "if Max HP reaches 0 the Pilot dies") and is surfaced by
 * isPilotDead(), not clamped away here.
 */
export function pilotMaxHP(pilot: PilotDerivationInput): number {
  return PILOT_BASE_HP + (pilot.maxHpModifier ?? 0) - injuryMaxHpPenalty(pilot.injuries)
}

/** Derived max AP (base 5 + Stat Training tiers etc.). */
export function pilotMaxAP(pilot: PilotDerivationInput): number {
  return PILOT_BASE_AP + (pilot.maxApModifier ?? 0)
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
  pilot: PilotDerivationInput & Pick<Pilot, 'currentHP' | 'currentAP'>
): Partial<Pick<Pilot, 'currentHP' | 'currentAP'>> {
  const patch: Partial<Pick<Pilot, 'currentHP' | 'currentAP'>> = {}
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

/** The chassis stats the mech derivations need (resolved from the ORM by name). */
export type ChassisStats = {
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  cargoCapacity?: number
}

type MechDerivationInput = Pick<
  Mech,
  'chassisRef' | 'maxSpModifier' | 'maxEpModifier' | 'maxHeatModifier' | 'maxCargoModifier'
>

/**
 * Resolve a mech's chassis from the reference ORM. `chassisRef` stores the
 * chassis NAME (matching the builder and lib/rules/capacity.ts), not a slug.
 */
export function findChassisByRef(chassisRef: string): ChassisStats | null {
  return SalvageUnionReference.Chassis.find((c) => c.name === chassisRef) ?? null
}

function resolveChassis(mech: MechDerivationInput, chassis?: ChassisStats | null): ChassisStats {
  return chassis ?? findChassisByRef(mech.chassisRef) ?? {}
}

/**
 * Derived mech maxima: chassis stat + hand-edited modifier (heat sinks,
 * capacitance banks, composite armour, holds — rules B2/B4/B6/B14).
 * Pass a pre-resolved `chassis` to avoid repeated ORM lookups; floored at 0
 * so a negative modifier never produces a negative maximum.
 */
export function mechMaxSP(mech: MechDerivationInput, chassis?: ChassisStats | null): number {
  const c = resolveChassis(mech, chassis)
  return Math.max(0, (c.structurePoints ?? 0) + (mech.maxSpModifier ?? 0))
}

export function mechMaxEP(mech: MechDerivationInput, chassis?: ChassisStats | null): number {
  const c = resolveChassis(mech, chassis)
  return Math.max(0, (c.energyPoints ?? 0) + (mech.maxEpModifier ?? 0))
}

export function mechMaxHeat(mech: MechDerivationInput, chassis?: ChassisStats | null): number {
  const c = resolveChassis(mech, chassis)
  return Math.max(0, (c.heatCapacity ?? 0) + (mech.maxHeatModifier ?? 0))
}

export function mechMaxCargo(mech: MechDerivationInput, chassis?: ChassisStats | null): number {
  const c = resolveChassis(mech, chassis)
  return Math.max(0, (c.cargoCapacity ?? 0) + (mech.maxCargoModifier ?? 0))
}

/**
 * Clamp current SP/EP/Heat to the derived maxima. Run after any modifier or
 * chassis change and persist the returned patch when non-empty.
 * (Cargo is a slot count, not a current/max pair — over-capacity cargo is
 * displayed honestly, never clamped, per design §2.12.)
 */
export function clampMechCurrentStats(
  mech: MechDerivationInput & Pick<Mech, 'currentSP' | 'currentEP' | 'currentHeat'>,
  chassis?: ChassisStats | null
): Partial<Pick<Mech, 'currentSP' | 'currentEP' | 'currentHeat'>> {
  const c = resolveChassis(mech, chassis)
  const patch: Partial<Pick<Mech, 'currentSP' | 'currentEP' | 'currentHeat'>> = {}
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
export function unifiedMechConditions(
  mech: Pick<Mech, 'conditions' | 'shutdown' | 'vulnerable' | 'destroyed'>
): string[] {
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

type CrawlerDerivationInput = Pick<Crawler, 'techLevel' | 'maxSpModifier'>

/**
 * Derived crawler max SP: the tech level's structurePoints from the reference
 * ORM (20/25/30/35/40/50 for TL 1–6) plus the hand-edited maxSpModifier
 * (Battle Crawler +5). Returns the modifier alone (≥0) when the techLevel
 * slug cannot be resolved — and the caller should surface that as a data
 * problem rather than rendering a silent 0-pip track.
 */
export function crawlerMaxSP(crawler: CrawlerDerivationInput): number {
  const tl = parseCrawlerTechLevel(crawler.techLevel)
  const base =
    tl === undefined
      ? 0
      : (SalvageUnionReference.CrawlerTechLevels.find((t) => t.techLevel === tl)?.structurePoints ??
        0)
  return Math.max(0, base + (crawler.maxSpModifier ?? 0))
}

/**
 * Clamp current SP to the derived max. Persist the returned patch when
 * non-empty (e.g. after editing maxSpModifier or downgrading tech level).
 */
export function clampCrawlerCurrentStats(
  crawler: CrawlerDerivationInput & Pick<Crawler, 'currentSP'>
): Partial<Pick<Crawler, 'currentSP'>> {
  const maxSP = crawlerMaxSP(crawler)
  if (crawler.currentSP !== undefined && crawler.currentSP > maxSP) {
    return { currentSP: maxSP }
  }
  return {}
}
