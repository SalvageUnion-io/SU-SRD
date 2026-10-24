/**
 * downtimeEconomy — pure patch builders for the Downtime economy layers.
 *
 * Same contract as `playActions`: nothing here touches React or the store.
 * Each function takes live numbers and returns the write-through patch(es) the
 * caller hands to `storeState.update` / `.transfer`, so the handlers stay
 * trivially testable and the ADR-006 pure-math boundary holds — `lib/rules/*`
 * owns the maths, this only assembles patches.
 *
 * This module is Play's seam onto the `crafting`, `salvage` and
 * `scrapMech` rules, not new rules: Area Salvage's haul into a mech's Cargo
 * Slots or a pilot's inventory, and a downed wreck's into the crawler.
 *
 * ADR-007 boundary: nothing here decides to destroy anything. `scrapMechPatch`
 * assembles the consequence of a scrap the player has already confirmed; the
 * confirmation itself stays an explicit call at the UI layer.
 */

import { makeScrapLot, makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { AreaSalvageResult, MechSalvageBand } from 'salvageunion-reference/rules'
import { mechSalvageAllows, mechSalvageScrap } from 'salvageunion-reference/rules'
import { carrierCargoUsage } from '../cargo/cargoTransfer'
import type { CraftableItem } from './crafting'
import { craftedLot, craftQuote } from './crafting'
import { pilotInventoryUsed } from './pilotInventory'
import {
  depositScrapDeposits,
  handOffCargo,
  mechScrapComponents,
  scrapMechBreakdown,
} from './scrapMech'

/** The crawler's numeric Tech Level, or undefined when the slug is unparseable. */
export function crawlerTechLevelOf(crawler: Pick<Crawler, 'techLevel'>): number | undefined {
  const digits = (crawler.techLevel ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : undefined
}

// ─── crafting (F3) ───────────────────────────────────────────────────────────

export type CraftOutcome = {
  quote: ReturnType<typeof craftQuote>
  /** Null when the craft is not allowed — the caller shows the reason instead. */
  patch: Partial<Crawler> | null
  /** Why the craft is blocked, for the rule brief. Undefined when allowed. */
  blocked?: 'tech-level' | 'scrap'
}

/**
 * Quote a craft and, when it is legal AND affordable, assemble the patch:
 * the pool after paying, plus the crafted item as a cargo lot.
 *
 * Guided Play enforces (ADR-021), so an ineligible or unaffordable craft
 * returns a null patch and a reason rather than a patch the caller must
 * remember not to apply.
 */
export function craftOutcome(
  crawler: Pick<Crawler, 'techLevel' | 'scrapPool' | 'cargoLots'>,
  item: CraftableItem
): CraftOutcome {
  const crawlerTl = crawlerTechLevelOf(crawler) ?? 0
  const quote = craftQuote(item, (crawler.scrapPool ?? {}) as ScrapPool, crawlerTl)
  if (!quote.eligible) return { quote, patch: null, blocked: 'tech-level' }
  if (!quote.affordable) return { quote, patch: null, blocked: 'scrap' }
  return {
    quote,
    patch: {
      scrapPool: quote.pool,
      cargoLots: [...(crawler.cargoLots ?? []), craftedLot(item)],
    },
  }
}

// ─── area salvage (F2) ───────────────────────────────────────────────────────

/** Inventory Slots one Scrap takes on a pilot (Core Book p.20, p.249). */
export const PILOT_SCRAP_SLOTS = 3

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
export function pilotScrapName(tl: number): string {
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

/** One part of a downed mech: its Chassis, or a System or Module it mounted. */
export type WreckPart = {
  key: string
  kind: 'chassis' | 'system' | 'module'
  name: string
  /** Numeric TL 1–6 when known: the Scrap a 2–5 pays is of the Chassis's. */
  techLevel?: number
  salvageValue: number
}

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

// ─── scrap mech (F4) ─────────────────────────────────────────────────────────

export type ScrapMechOutcome = {
  breakdown: ReturnType<typeof scrapMechBreakdown>
  /** The crawler patch: its pool after the scrap, plus any cargo handed over. */
  crawlerPatch: Partial<Crawler>
  /** The mech patch marking it consumed. */
  mechPatch: Partial<Mech>
  /** True when the mech's hold moved to the crawler rather than being lost. */
  cargoHandedOff: boolean
}

/**
 * Assemble the consequence of scrapping a mech into a crawler's pool.
 *
 * Cross-entity by nature — the scrap leaves the mech and enters the crawler —
 * so the caller commits both halves through `entityStore.transfer`, which is
 * all-or-nothing: a partial write here would duplicate or destroy player value.
 *
 * **A scrapped mech is not a destroyed one.** Deliberately breaking a mech down
 * hands its hold to the crawler; nothing in the hold was ever part of the mech,
 * so losing it would be silent data loss. A mech that was already DESTROYED has
 * lost its cargo with it (p.234/p.240), so the hand-off is skipped — the rule
 * `handOffCargo` states in its own header, and the distinction the caller must
 * make rather than the module.
 *
 * The mech is marked `destroyed` rather than deleted: deleting the record would
 * take its Change Log and its soft-links with it, and ADR-007 keeps destruction
 * visible rather than silently dropping data.
 */
export function scrapMechOutcome(
  mech: Parameters<typeof mechScrapComponents>[0] & Pick<Mech, 'id' | 'cargoLots' | 'destroyed'>,
  crawler: Pick<Crawler, 'scrapPool' | 'cargoLots'>
): ScrapMechOutcome {
  const components = mechScrapComponents(mech)
  const breakdown = scrapMechBreakdown(components)
  const pooled = depositScrapDeposits((crawler.scrapPool ?? {}) as ScrapPool, breakdown.deposits)

  if (mech.destroyed) {
    return {
      breakdown,
      crawlerPatch: { scrapPool: pooled },
      mechPatch: { destroyed: true },
      cargoHandedOff: false,
    }
  }

  const handed = handOffCargo(mech.cargoLots ?? [], crawler.cargoLots ?? [], pooled)
  return {
    breakdown,
    crawlerPatch: { scrapPool: handed.pool, cargoLots: handed.crawlerLots },
    mechPatch: { destroyed: true, cargoLots: [] },
    cargoHandedOff: true,
  }
}
