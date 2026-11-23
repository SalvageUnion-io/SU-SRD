/**
 * Tally Salvage's Scrap (Core Book p.227, r6 D1): what a pilot carries home,
 * in their inventory and their mech's Cargo, by Tech Level, and the writes
 * that move it into the crawler's shared pool. Pure: the rooms run it on the
 * bodies they hold, and the app reads the same totals to show them.
 *
 * A pilot carries Scrap as inventory entries named "Tech N Scrap" (three
 * Slots each, p.20); a mech as SCRAP lots in its Cargo (one Slot each,
 * p.246). Nothing else is moved: a kept Chassis, System or Module is the
 * table's to note.
 */

import type { CargoLot } from '../schemas/cargoLot'
import type { ScrapPool } from '../schemas/crawler'

/** Scrap by Tech Level, 1 to 6: `{ 1: 3, 2: 1 }`. */
export type ScrapByTl = Readonly<Partial<Record<number, number>>>

const PILOT_SCRAP = /^Tech ([1-6]) Scrap$/

type PilotInventory = {
  genericInventory?: readonly { name: string; qty?: number }[]
}
type MechCargo = { cargoLots?: readonly CargoLot[] }

const isTl = (tl: unknown): tl is number =>
  typeof tl === 'number' && Number.isInteger(tl) && tl >= 1 && tl <= 6

function add(into: Partial<Record<number, number>>, tl: number, count: number) {
  if (count > 0) into[tl] = (into[tl] ?? 0) + count
}

/** The Scrap a pilot carries in their inventory, by Tech Level. */
export function pilotScrap(pilot: PilotInventory | null | undefined): ScrapByTl {
  const by: Partial<Record<number, number>> = {}
  for (const entry of pilot?.genericInventory ?? []) {
    const tl = PILOT_SCRAP.exec(entry.name)?.[1]
    if (tl !== undefined) add(by, Number(tl), entry.qty ?? 1)
  }
  return by
}

/** The Scrap in a mech's Cargo, by Tech Level. */
export function mechScrap(mech: MechCargo | null | undefined): ScrapByTl {
  const by: Partial<Record<number, number>> = {}
  for (const lot of mech?.cargoLots ?? []) {
    if (lot.cat === 'SCRAP' && isTl(lot.tl)) add(by, lot.tl, lot.qty ?? lot.units)
  }
  return by
}

/** Two tallies as one. */
export function sumScrap(...tallies: readonly ScrapByTl[]): ScrapByTl {
  const by: Partial<Record<number, number>> = {}
  for (const tally of tallies)
    for (const [tl, count] of Object.entries(tally)) add(by, Number(tl), count ?? 0)
  return by
}

/** How many pieces of Scrap a tally holds. */
export function scrapCount(tally: ScrapByTl): number {
  return Object.values(tally).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

/** The pool with a tally added, bucket by bucket. */
export function depositScrap(pool: ScrapPool, tally: ScrapByTl): ScrapPool {
  const next: ScrapPool = { ...pool }
  for (const [tl, count] of Object.entries(tally)) {
    const key = `tl${tl}` as 'tl1'
    if (isTl(Number(tl)) && (count ?? 0) > 0) next[key] = (next[key] ?? 0) + (count ?? 0)
  }
  return next
}

/**
 * Moving a pilot's carried Scrap to the crawler: the tally, and each body's
 * patch (null where it carried none). The pool's patch is built on the
 * crawler's body at the moment of the write.
 */
export function scrapMove(
  pilot: PilotInventory,
  mech: MechCargo | null,
  crawler: { scrapPool?: ScrapPool }
): {
  moved: ScrapByTl
  pilotPatch: { genericInventory: NonNullable<PilotInventory['genericInventory']> } | null
  mechPatch: { cargoLots: CargoLot[] } | null
  crawlerPatch: { scrapPool: ScrapPool }
} {
  const fromPilot = pilotScrap(pilot)
  const fromMech = mechScrap(mech)
  const moved = sumScrap(fromPilot, fromMech)
  return {
    moved,
    pilotPatch:
      scrapCount(fromPilot) === 0
        ? null
        : {
            genericInventory: (pilot.genericInventory ?? []).filter(
              (e) => !PILOT_SCRAP.test(e.name)
            ),
          },
    mechPatch:
      mech === null || scrapCount(fromMech) === 0
        ? null
        : {
            cargoLots: (mech.cargoLots ?? []).filter(
              (lot) => !(lot.cat === 'SCRAP' && isTl(lot.tl))
            ),
          },
    crawlerPatch: { scrapPool: depositScrap(crawler.scrapPool ?? {}, moved) },
  }
}
