/**
 * Area Salvage / Mech Salvage rules (design-review R-3).
 *
 * Salvage Union Core Book pp. 244–248 — the game's title loop.
 *
 * Rules summary:
 * - **Area Salvage** (p.245/248): an area has a Tech Level and a Supply
 *   (default 5). Each roll costs 1 Supply. d20:
 *     1     → nothing
 *     2-5   → 1 Scrap of the area's TL
 *     6-10  → 2 Scrap
 *     11-19 → 3 Scrap
 *     20    → a Mech Chassis, System, or Module at the area's TL, Damaged
 *             (randomised or chosen — a player/table call per ADR-007)
 * - **Mech Salvage** (p.245/248): roll over a wreck's chassis. d20:
 *     1     → unsalvageable, everything destroyed
 *     2-5   → half the chassis Salvage Value in Scrap of its TL (min 1)
 *     6-10  → claim a System OR Module of your choice, Damaged
 *     11-19 → claim the Chassis OR a System OR a Module, Damaged
 *     20    → claim the Chassis AND a System AND a Module, Damaged
 * - A salvaged Chassis/System/Module occupies cargo slots equal to its
 *   Salvage Value (p.246); each Scrap is 1 slot.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness — the d20
 * is injected via the shared `Roll` type (same seam as heatCheck.ts). The
 * functions compute the deterministic bookkeeping (scrap quantities, granted
 * chassis, remaining claims); WHICH System/Module comes off the wreck is the
 * table's narrative call, expressed as a `SalvageClaim` the UI walks down via
 * `takeFromClaim` — this module never auto-picks an item (ADR-007).
 */

import type { CargoLot } from '../schemas/cargoLot'
import { makeUnitLot } from '../schemas/cargoLot'
import type { Roll } from './heatCheck'

/** Default Supply of an area (p.245) — hand-editable in the UI (honor system). */
export const AREA_SALVAGE_DEFAULT_SUPPLY = 5

// ---------------------------------------------------------------------------
// Area Salvage (p.248 / roll-tables.json "Area Salvage")
// ---------------------------------------------------------------------------

export type AreaSalvageBand = 'nothing' | 'scrap-1' | 'scrap-2' | 'scrap-3' | 'jackpot'

/** Maps an Area Salvage d20 roll to its band. */
export function areaSalvageBand(roll: number): AreaSalvageBand {
  if (roll <= 1) return 'nothing'
  if (roll <= 5) return 'scrap-1'
  if (roll <= 10) return 'scrap-2'
  if (roll <= 19) return 'scrap-3'
  return 'jackpot'
}

/** Table labels, verbatim from the Area Salvage table. */
export const AREA_SALVAGE_LABEL: Record<AreaSalvageBand, string> = {
  nothing: 'Nothing',
  'scrap-1': 'Better than Nothing',
  'scrap-2': 'Not Bad',
  'scrap-3': 'Winning',
  jackpot: 'Jackpot!',
}

const AREA_SALVAGE_SCRAP: Record<AreaSalvageBand, number> = {
  nothing: 0,
  'scrap-1': 1,
  'scrap-2': 2,
  'scrap-3': 3,
  jackpot: 0,
}

export type AreaSalvageResult = {
  roll: number
  band: AreaSalvageBand
  label: string
  /** Scrap found (auto-deposits into the pool). 0 on nothing/jackpot. */
  scrapQty: number
  /** The area's TL — the TL of the scrap and of a jackpot item. */
  areaTl: number
  /** True on a 20 — the player picks a Damaged Chassis/System/Module at `areaTl`. */
  requiresPlayerChoice: boolean
}

type AreaSalvageInput = {
  /** The area's Tech Level (set by the Mediator, p.245). */
  areaTl: number
  /** Injectable d20 roller. */
  roll: Roll
}

/** Performs one Area Salvage roll. Supply accounting is the caller's job. */
export function performAreaSalvage({ areaTl, roll }: AreaSalvageInput): AreaSalvageResult {
  const d20 = roll(20)
  const band = areaSalvageBand(d20)
  return {
    roll: d20,
    band,
    label: AREA_SALVAGE_LABEL[band],
    scrapQty: AREA_SALVAGE_SCRAP[band],
    areaTl,
    requiresPlayerChoice: band === 'jackpot',
  }
}

// ---------------------------------------------------------------------------
// Claims — what the player may still take off a wreck / jackpot (ADR-007)
// ---------------------------------------------------------------------------

/**
 * The outstanding player choice after a salvage roll. All claimed items land
 * Damaged. `chassisExclusive` encodes the 11-19 "Chassis OR System OR Module":
 * taking ANY item consumes the whole claim.
 */
export type SalvageClaim = {
  /** The chassis is claimable. */
  chassis: boolean
  /** Taking anything consumes the entire claim (the 11-19 / jackpot OR). */
  chassisExclusive: boolean
  /** Picks that must be Systems (the 20 band grants exactly one). */
  systemPicks: number
  /** Picks that must be Modules (the 20 band grants exactly one). */
  modulePicks: number
  /** Picks satisfiable by a System OR a Module (6-10 / 11-19). */
  eitherPicks: number
}

export const EMPTY_CLAIM: SalvageClaim = {
  chassis: false,
  chassisExclusive: false,
  systemPicks: 0,
  modulePicks: 0,
  eitherPicks: 0,
}

/**
 * The Area Salvage 20 claim: ONE of a Chassis, System, or Module at the
 * area's TL.
 */
export function areaJackpotClaim(): SalvageClaim {
  return { ...EMPTY_CLAIM, chassis: true, chassisExclusive: true, eitherPicks: 1 }
}

export type SalvageTakeKind = 'chassis' | 'system' | 'module'

/** True when the claim still allows taking an item of `kind`. */
export function claimAllows(claim: SalvageClaim, kind: SalvageTakeKind): boolean {
  if (kind === 'chassis') return claim.chassis
  if (kind === 'system') return claim.systemPicks > 0 || claim.eitherPicks > 0
  return claim.modulePicks > 0 || claim.eitherPicks > 0
}

/**
 * Consume one take from the claim. Exclusive claims (the OR bands) zero out
 * entirely on any take; otherwise the kind-specific counter decrements before
 * the flexible one. Invalid takes return the claim unchanged.
 */
export function takeFromClaim(claim: SalvageClaim, kind: SalvageTakeKind): SalvageClaim {
  if (!claimAllows(claim, kind)) return claim
  if (claim.chassisExclusive) return EMPTY_CLAIM
  if (kind === 'chassis') return { ...claim, chassis: false }
  if (kind === 'system') {
    return claim.systemPicks > 0
      ? { ...claim, systemPicks: claim.systemPicks - 1 }
      : { ...claim, eitherPicks: claim.eitherPicks - 1 }
  }
  return claim.modulePicks > 0
    ? { ...claim, modulePicks: claim.modulePicks - 1 }
    : { ...claim, eitherPicks: claim.eitherPicks - 1 }
}

/** True when nothing is left to claim. */
export function claimExhausted(claim: SalvageClaim): boolean {
  return (
    !claim.chassis && claim.systemPicks <= 0 && claim.modulePicks <= 0 && claim.eitherPicks <= 0
  )
}

// ---------------------------------------------------------------------------
// Mech Salvage (p.248 / roll-tables.json "Mech Salvage")
// ---------------------------------------------------------------------------

export type MechSalvageBand =
  | 'unsalvageable'
  | 'scrap'
  | 'system-or-module'
  | 'chassis-or-item'
  | 'full-strip'

/** Maps a Mech Salvage d20 roll to its band. */
export function mechSalvageBand(roll: number): MechSalvageBand {
  if (roll <= 1) return 'unsalvageable'
  if (roll <= 5) return 'scrap'
  if (roll <= 10) return 'system-or-module'
  if (roll <= 19) return 'chassis-or-item'
  return 'full-strip'
}

/** Table labels, verbatim from the Mech Salvage table. */
export const MECH_SALVAGE_LABEL: Record<MechSalvageBand, string> = {
  unsalvageable: 'Ashes and Dust',
  scrap: 'Nuts and Bolts',
  'system-or-module': 'Bits and Pieces',
  'chassis-or-item': 'Meat and Potatoes',
  'full-strip': 'Lions Share',
}

/** Half the Salvage Value, rounded down, minimum 1 (the 2-5 band). */
export function halfSalvageScrap(salvageValue: number): number {
  return Math.max(1, Math.floor(salvageValue / 2))
}

/** The wreck's chassis — the minimal shape the roll needs. */
export type WreckChassis = {
  name: string
  techLevel: number
  salvageValue: number
}

export type MechSalvageResult = {
  roll: number
  band: MechSalvageBand
  label: string
  /** Auto-deposited scrap (2-5 band): half the chassis SV, min 1. 0 otherwise. */
  scrapQty: number
  /** TL of the deposited scrap — the chassis TL. */
  scrapTl: number
  /** True on a 20 — the wreck's chassis lands in storage without a pick. */
  chassisGranted: boolean
  /** What the player may still claim (ADR-007 — never auto-picked). */
  claim: SalvageClaim
  requiresPlayerChoice: boolean
}

type MechSalvageInput = {
  /** The wreck's chassis. */
  chassis: WreckChassis
  /** Injectable d20 roller. */
  roll: Roll
}

/** Performs one Mech Salvage roll over a wreck. */
export function performMechSalvage({ chassis, roll }: MechSalvageInput): MechSalvageResult {
  const d20 = roll(20)
  const band = mechSalvageBand(d20)

  let scrapQty = 0
  let chassisGranted = false
  let claim: SalvageClaim = EMPTY_CLAIM

  if (band === 'scrap') {
    scrapQty = halfSalvageScrap(chassis.salvageValue)
  } else if (band === 'system-or-module') {
    claim = { ...EMPTY_CLAIM, eitherPicks: 1 }
  } else if (band === 'chassis-or-item') {
    claim = { ...EMPTY_CLAIM, chassis: true, chassisExclusive: true, eitherPicks: 1 }
  } else if (band === 'full-strip') {
    chassisGranted = true
    claim = { ...EMPTY_CLAIM, systemPicks: 1, modulePicks: 1 }
  }

  return {
    roll: d20,
    band,
    label: MECH_SALVAGE_LABEL[band],
    scrapQty,
    scrapTl: chassis.techLevel,
    chassisGranted,
    claim,
    requiresPlayerChoice: !claimExhausted(claim),
  }
}

// ---------------------------------------------------------------------------
// Deposits — salvage → cargo lots
// ---------------------------------------------------------------------------

/** The minimal shape of a salvaged item (chassis, system, or module). */
export type SalvagedItem = {
  name: string
  salvageValue: number
  /** Numeric TL (1–6) when known — carried onto the lot for display. */
  techLevel?: number
}

/**
 * Build the Damaged unit cargo lot for a salvaged Chassis/System/Module.
 * Slots = Salvage Value (p.246), floored at 1 so a lot never costs 0.
 */
export function damagedSalvageLot(item: SalvagedItem): CargoLot {
  const tl =
    typeof item.techLevel === 'number' &&
    Number.isInteger(item.techLevel) &&
    item.techLevel >= 1 &&
    item.techLevel <= 6
      ? item.techLevel
      : undefined
  return makeUnitLot(`${item.name} (Damaged)`, {
    cat: 'SYSTEM',
    units: Math.max(1, item.salvageValue),
    ...(tl !== undefined ? { tl } : {}),
  })
}
