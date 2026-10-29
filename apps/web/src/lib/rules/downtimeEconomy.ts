/**
 * downtimeEconomy — pure patch builders for the Downtime economy layers.
 *
 * Same contract as `playActions`: nothing here touches React or the store.
 * Each function takes live numbers and returns the write-through patch(es) the
 * caller hands to `storeState.update` / `.transfer`, so the handlers stay
 * trivially testable and the ADR-006 pure-math boundary holds — `lib/rules/*`
 * owns the maths, this only assembles patches.
 *
 * This module is Play's seam onto the `salvage` rules, not new rules: Area
 * Salvage's haul into a mech's Cargo Slots or a pilot's inventory, and a
 * downed wreck's into the crawler.
 */

import type { WreckPart } from 'game-domain/rules/wreck'
import { makeScrapLot, makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { AreaSalvageResult, MechSalvageBand } from 'salvageunion-reference/rules'
import { mechSalvageAllows, mechSalvageScrap } from 'salvageunion-reference/rules'
import { addToScrapPool, carrierCargoUsage } from '../cargo/cargoTransfer'
import type { PoolDraw } from './crawlerEconomy'
import { pilotInventoryUsed } from './pilotInventory'

// ─── area salvage (F2) ───────────────────────────────────────────────────────

/** Inventory Slots one Scrap takes on a pilot (Core Book p.20, p.249). */
const PILOT_SCRAP_SLOTS = 3

export type AreaSalvageHaul<T> = {
  /** Scrap that fits, at the area's Tech Level. */
  carried: number
  /** Scrap found that there was no room for: it stays in the area. */
  leftBehind: number
  /** Null when nothing is carried: there is no write to make. */
  patch: Partial<T> | null
}

/** Split what an Area Salvage found between what fits and what stays behind. */
function haulOf(result: AreaSalvageResult, room: number) {
  const carried = Math.max(0, Math.min(result.scrapQty, room))
  return { carried, leftBehind: result.scrapQty - carried }
}

/**
 * Load an Area Salvage's Scrap into a mech's Cargo Slots, one Slot a Scrap
 * (p.246), merged into the hold's lot of that Tech Level when it has one.
 * What does not fit is left in the area, never squeezed in: the rules say
 * a mech cannot carry what it has no Slots for.
 *
 * A "nothing" band and a jackpot can both yield 0 scrap: the first found none,
 * the second hands the player an ITEM choice rather than scrap (ADR-007). Either
 * way a 0 haul returns a null patch, so the caller reports the result without a
 * no-op write in the Change Log.
 */
export function areaSalvageToMech(
  mech: Pick<Mech, 'cargoLots'>,
  cargoCap: number,
  result: AreaSalvageResult
): AreaSalvageHaul<Mech> {
  const lots = mech.cargoLots ?? []
  const { carried, leftBehind } = haulOf(result, carrierCargoUsage(lots, cargoCap).free)
  if (carried === 0) return { carried, leftBehind, patch: null }
  const tl = result.areaTl
  const same = lots.findIndex((l) => l.cat === 'SCRAP' && l.kind === 'bulk' && l.tl === tl)
  const cargoLots =
    same === -1
      ? [...lots, makeScrapLot(tl, carried)]
      : lots.map((lot, i) => {
          if (i !== same) return lot
          const qty = (lot.qty ?? lot.units) + carried
          return { ...lot, qty, units: qty }
        })
  return { carried, leftBehind, patch: { cargoLots } }
}

/** The name a pilot's carried Scrap goes by, its Tech Level in it. */
function pilotScrapName(tl: number): string {
  return `Tech ${tl} Scrap`
}

/**
 * Put an Area Salvage's Scrap in an on-foot pilot's inventory, three Slots a
 * Scrap (p.20), stacked on the entry of that Tech Level when there is one.
 * As for a mech, what does not fit stays in the area.
 */
export function areaSalvageToPilot(
  pilot: Pick<Pilot, 'equipment' | 'genericInventory'>,
  inventoryCap: number,
  result: AreaSalvageResult
): AreaSalvageHaul<Pilot> {
  const free = Math.max(0, inventoryCap - pilotInventoryUsed(pilot))
  const { carried, leftBehind } = haulOf(result, Math.floor(free / PILOT_SCRAP_SLOTS))
  if (carried === 0) return { carried, leftBehind, patch: null }
  const name = pilotScrapName(result.areaTl)
  const entries = pilot.genericInventory ?? []
  const same = entries.findIndex((e) => e.name === name && e.slotCost === PILOT_SCRAP_SLOTS)
  const genericInventory =
    same === -1
      ? [...entries, { id: crypto.randomUUID(), name, slotCost: PILOT_SCRAP_SLOTS, qty: carried }]
      : entries.map((e, i) => (i === same ? { ...e, qty: (e.qty ?? 1) + carried } : e))
  return { carried, leftBehind, patch: { genericInventory } }
}

// ─── mech salvage of a wreck (F2) ────────────────────────────────────────────

export type WreckSalvageOutcome = {
  /** Null when the band yields nothing, or the picks are not the band's to take. */
  patch: Partial<Crawler> | null
  /** What the haul came to, for the readout: the parts' names, or the Scrap. */
  taken: string[]
}

/**
 * The haul of a Mech Salvage on a downed mech, deposited at the crawler (the
 * Mediator keeps it, ADR-038 §5): on a 2–5, half the Chassis's Salvage Value
 * in Scrap of its Tech Level into the pool; on 6 and up, each part the
 * salvager picked into the hold as a Damaged lot of its Salvage Value in
 * Slots (p.246). Picks the band does not allow write nothing (ADR-021: Play
 * enforces); a 1, or a pick of nothing, writes nothing.
 */
export function wreckSalvageOutcome(
  crawler: Pick<Crawler, 'scrapPool' | 'cargoLots'>,
  parts: readonly WreckPart[],
  band: MechSalvageBand,
  picked: readonly string[]
): WreckSalvageOutcome {
  if (band === 'nuts') {
    const chassis = parts.find((p) => p.kind === 'chassis')
    if (chassis?.techLevel === undefined) return { patch: null, taken: [] }
    const count = mechSalvageScrap(chassis.salvageValue)
    return {
      patch: {
        scrapPool: depositScrapDeposits((crawler.scrapPool ?? {}) as ScrapPool, [
          { tl: chassis.techLevel, count },
        ]),
      },
      taken: [`${count} ${pilotScrapName(chassis.techLevel)}`],
    }
  }
  const chosen = parts.filter((p) => picked.includes(p.key))
  const pick = {
    chassis: chosen.some((p) => p.kind === 'chassis'),
    systems: chosen.filter((p) => p.kind === 'system').length,
    modules: chosen.filter((p) => p.kind === 'module').length,
  }
  if (chosen.length === 0 || !mechSalvageAllows(band, pick)) return { patch: null, taken: [] }
  const lots = chosen.map((p) =>
    makeUnitLot(`${p.name} (Damaged)`, {
      cat: 'SYSTEM',
      units: Math.max(1, p.salvageValue),
      ...(p.techLevel === undefined ? {} : { tl: p.techLevel }),
    })
  )
  return {
    patch: { cargoLots: [...lots, ...(crawler.cargoLots ?? [])] },
    taken: chosen.map((p) => p.name),
  }
}

/**
 * Scrap a downed non-mech (a Vehicle) for its Salvage Value in Scrap of its
 * Tech Level (p.246, "as per the Scrap Ability"), into the crawler's pool.
 */
export function wreckScrapOutcome(
  crawler: Pick<Crawler, 'scrapPool'>,
  wreck: { techLevel: number; salvageValue: number }
): Partial<Crawler> | null {
  if (wreck.salvageValue <= 0) return null
  return {
    scrapPool: depositScrapDeposits((crawler.scrapPool ?? {}) as ScrapPool, [
      { tl: wreck.techLevel, count: wreck.salvageValue },
    ]),
  }
}

/** Add scrap deposits to the crawler's shared scrap pool. */
export function depositScrapDeposits(pool: ScrapPool, deposits: PoolDraw[]): ScrapPool {
  return deposits.reduce((next, d) => addToScrapPool(next, d.tl, d.count), pool)
}
