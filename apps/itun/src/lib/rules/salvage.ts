/**
 * Area Salvage rules (design-review R-3).
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
 * This module is PURE: no React, no IndexedDB, no real randomness — the d20
 * is injected via the shared `Roll` type (same seam as heatCheck.ts). WHICH
 * item a jackpot yields is the table's call; this module never auto-picks one
 * (ADR-007).
 */

import type { Roll } from './heatCheck'

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
