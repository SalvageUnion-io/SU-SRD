import type { Roll } from './types'
/**
 * Area Salvage rules.
 *
 * Salvage Union Core Book pp. 244–248 — the game's title loop.
 *
 * - **Area Salvage** (p.245/248): an area has a Tech Level and a Supply
 *   (default 5). Each roll costs 1 Supply. d20:
 *     1     → nothing
 *     2-5   → 1 Scrap of the area's TL
 *     6-10  → 2 Scrap
 *     11-19 → 3 Scrap
 *     20    → a Mech Chassis, System, or Module at the area's TL, Damaged
 *             (randomised or chosen — a player/table call per ADR-007)
 *
 * - **Expert Salvager** (p.40): one more Scrap on every Area Salvage, so
 *   never none, and a second item on a 20.
 *
 * - **Mech Salvage** (p.248): a d20 on a downed Mech decides what may be
 *   taken from it, every pick Damaged and everything else destroyed:
 *     1     → nothing
 *     2-5   → half the Chassis's Salvage Value in Scrap of its TL (min 1)
 *     6-10  → a System or a Module
 *     11-19 → the Chassis, or a System, or a Module
 *     20    → the Chassis, a System and a Module
 *
 * This module is PURE: no React, no store, no real randomness — the d20
 * is injected via the shared `Roll` type (same seam as heatCheck.ts). WHICH
 * item a jackpot yields, and which parts a Mech Salvage takes, is the table's
 * call; this module never auto-picks one (ADR-007).
 */

// ---------------------------------------------------------------------------
// Area Salvage (p.248 / roll-tables.json "Area Salvage")
// ---------------------------------------------------------------------------

/** The roll tables these abilities read, by their names in roll-tables.json. */
export const AREA_SALVAGE_TABLE = 'Area Salvage'
export const MECH_SALVAGE_TABLE = 'Mech Salvage'

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
  /** Scrap found. 0 on nothing/jackpot, one more for an Expert Salvager. */
  scrapQty: number
  /** The area's TL — the TL of the scrap and of a jackpot item. */
  areaTl: number
  /** True on a 20 — the player picks a Damaged Chassis/System/Module at `areaTl`. */
  requiresPlayerChoice: boolean
  /** How many Damaged items a 20 finds: 1, or 2 for an Expert Salvager; else 0. */
  itemCount: number
}

type AreaSalvageInput = {
  /** The area's Tech Level (set by the Mediator, p.245). */
  areaTl: number
  /** Injectable d20 roller. */
  roll: Roll
  /** The salvager has Expert Salvager (Salvaging tree, p.40). */
  expert?: boolean
}

/** Performs one Area Salvage roll. Supply accounting is the caller's job. */
export function performAreaSalvage({
  areaTl,
  roll,
  expert = false,
}: AreaSalvageInput): AreaSalvageResult {
  return areaSalvageResult({ areaTl, d20: roll(20), expert })
}

/** An Area Salvage d20 already rolled, read as its result. */
export function areaSalvageResult({
  areaTl,
  d20,
  expert = false,
}: {
  areaTl: number
  d20: number
  expert?: boolean
}): AreaSalvageResult {
  const band = areaSalvageBand(d20)
  const jackpot = band === 'jackpot'
  return {
    roll: d20,
    band,
    label: AREA_SALVAGE_LABEL[band],
    scrapQty: AREA_SALVAGE_SCRAP[band] + (expert ? 1 : 0),
    areaTl,
    requiresPlayerChoice: jackpot,
    itemCount: jackpot ? (expert ? 2 : 1) : 0,
  }
}

// ---------------------------------------------------------------------------
// Mech Salvage (p.248 / roll-tables.json "Mech Salvage")
// ---------------------------------------------------------------------------

export type MechSalvageBand = 'ashes' | 'nuts' | 'bits' | 'meat' | 'lions'

/** Maps a Mech Salvage d20 roll to its band. */
export function mechSalvageBand(roll: number): MechSalvageBand {
  if (roll <= 1) return 'ashes'
  if (roll <= 5) return 'nuts'
  if (roll <= 10) return 'bits'
  if (roll <= 19) return 'meat'
  return 'lions'
}

/** Table labels, verbatim from the Mech Salvage table. */
export const MECH_SALVAGE_LABEL: Record<MechSalvageBand, string> = {
  ashes: 'Ashes and Dust',
  nuts: 'Nuts and Bolts',
  bits: 'Bits and Pieces',
  meat: 'Meat and Potatoes',
  lions: 'Lions Share',
}

/** What a salvager takes off the wreck: the Chassis or not, and how many Systems and Modules. */
export type MechSalvagePick = { chassis: boolean; systems: number; modules: number }

/**
 * Whether a band lets the salvager take `pick`. Taking less than a band
 * offers is always allowed: the rest is destroyed either way.
 */
export function mechSalvageAllows(band: MechSalvageBand, pick: MechSalvagePick): boolean {
  const { chassis, systems, modules } = pick
  if (systems < 0 || modules < 0) return false
  const parts = systems + modules
  switch (band) {
    case 'ashes':
    case 'nuts':
      return !chassis && parts === 0
    case 'bits':
      return !chassis && parts <= 1
    case 'meat':
      return (chassis ? 1 : 0) + parts <= 1
    case 'lions':
      return systems <= 1 && modules <= 1
  }
}

/** The 2–5 band's Scrap: half the Chassis's Salvage Value, rounded down, at least 1. */
export function mechSalvageScrap(chassisSalvageValue: number): number {
  return Math.max(1, Math.floor(Math.max(0, chassisSalvageValue) / 2))
}

export type MechSalvageResult = { roll: number; band: MechSalvageBand; label: string }

/** A Mech Salvage d20 already rolled, read as its band. */
export function mechSalvageResult(d20: number): MechSalvageResult {
  const band = mechSalvageBand(d20)
  return { roll: d20, band, label: MECH_SALVAGE_LABEL[band] }
}
