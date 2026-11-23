/**
 * Solo Downtime's Crafting Bay and Trading Bay, in Play (r6 D4, D5, D6). Pure:
 * no React, no store, the dice injected.
 *
 *  - **Craft** (Core Book p.222): a System or Module of the crawler's Tech
 *    Level or lower costs its Salvage Value in Scrap of its Tech Level or
 *    higher from the crawler's pool. Short, nothing is spent and the shortfall
 *    is said. Crafting spends Scrap in Play alone (`DOWNTIME_RULINGS.craftSpends`):
 *    the Live Sheet's Manage Systems stays free hand-editing (surfaces §2).
 *  - **Trade** (p.223): after the availability roll the wares are picked at
 *    random at the rolled Tech Level (the rules allow random or the
 *    Mediator's choice), each one Choose-instead away from any other of its
 *    kind; Buy spends its Salvage Value in Scrap of that Tech Level or higher
 *    and puts it in the Storage Bay (the crawler's hold).
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { EntityRef } from 'salvageunion-reference'
import { entityRef, getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { isNumericTechLevel } from 'salvageunion-reference/rules'
import type { PoolDraw, TradingAvailability } from '../lib/rules/crawlerEconomy'
import { drawFromPool, poolShortfall } from '../lib/rules/crawlerEconomy'

/** The Trading Bay Table (Core Book p.223), by its reference name. */
export const TRADING_BAY_TABLE = 'Trading Bay'

/** What a bay makes or sells. */
export type WareKind = 'system' | 'module' | 'chassis'

/** One thing to craft or buy: its slug, name, Tech Level and Salvage Value. */
export type Ware = {
  kind: WareKind
  slug: string
  name: string
  tl: number
  salvageValue: number
  /** Its reference entity, for its Mention. */
  ref: EntityRef
}

function waresOf(kind: WareKind): Ware[] {
  const all =
    kind === 'system'
      ? SalvageUnionReference.Systems.all()
      : kind === 'module'
        ? SalvageUnionReference.Modules.all()
        : SalvageUnionReference.Chassis.all()
  return all.flatMap((item) => {
    const tl = item.techLevel
    if (typeof tl !== 'number' || !isNumericTechLevel(tl)) return []
    return [
      {
        kind,
        slug: getEntitySlug(item),
        name: item.name,
        tl,
        salvageValue: item.salvageValue,
        ref: entityRef(item),
      },
    ]
  })
}

const byTlThenName = (a: Ware, b: Ware) => a.tl - b.tl || a.name.localeCompare(b.name)

/** The Systems and Modules a Crafting Bay of `crawlerTl` makes (p.222), lowest Tech Level first. */
export function craftables(crawlerTl: number): Ware[] {
  return [...waresOf('system'), ...waresOf('module')]
    .filter((w) => w.tl <= crawlerTl)
    .sort(byTlThenName)
}

/** The craftables whose name holds `query`, at most `limit`; none for an empty query. */
export function findCraftables(crawlerTl: number, query: string, limit = 8): Ware[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return []
  return craftables(crawlerTl)
    .filter((w) => w.name.toLowerCase().includes(q))
    .slice(0, limit)
}

/** Every ware of a kind at exactly `tl`, A–Z: what Choose instead lists. */
export function waresAt(kind: WareKind, tl: number): Ware[] {
  return waresOf(kind)
    .filter((w) => w.tl === tl)
    .sort(byTlThenName)
}

/** A ware's price: its Salvage Value in Scrap of its Tech Level or higher (pp.222-223). */
export type Spend =
  | { ok: true; pool: ScrapPool; draws: PoolDraw[] }
  | { ok: false; short: number; tl: number }

/** Spend a ware's price from the pool, all or nothing; short, how much is missing. */
export function spendFor(pool: ScrapPool, ware: Pick<Ware, 'tl' | 'salvageValue'>): Spend {
  const drawn = drawFromPool(pool, ware.tl, ware.salvageValue)
  if (drawn === null)
    return { ok: false, short: poolShortfall(pool, ware.tl, ware.salvageValue), tl: ware.tl }
  return { ok: true, pool: drawn.pool, draws: drawn.draws }
}

/** The kinds the Trading Bay Table's band offers (p.223), in the order it names them. */
function offeredKinds(availability: TradingAvailability): WareKind[] {
  switch (availability) {
    case 'chassis':
      return ['chassis']
    case 'system-and-module':
      return ['system', 'module']
    case 'system':
      return ['system']
    case 'module':
      return ['module']
    case 'nothing':
      return []
  }
}

/**
 * The wares for sale this Downtime: one of each kind the band offers, picked
 * at random at `tl` (`pick(n)` answers 1..n, the injected die). A kind with
 * nothing at that Tech Level offers nothing.
 */
export function tradeOffers(
  availability: TradingAvailability,
  tl: number,
  pick: (n: number) => number
): Ware[] {
  return offeredKinds(availability).flatMap((kind) => {
    const all = waresAt(kind, tl)
    if (all.length === 0) return []
    const chosen = all[Math.min(all.length, Math.max(1, pick(all.length))) - 1]
    return chosen ? [chosen] : []
  })
}

/** A ware in the Storage Bay: a lot in the crawler's hold, its Salvage Value in Slots. */
function storedLot(ware: Ware): CargoLot {
  return makeUnitLot(ware.name, {
    cat: 'SYSTEM',
    units: Math.max(1, ware.salvageValue),
    tl: ware.tl,
  })
}

/** The crawler's patch for a spend that stores the ware. */
export function storePatch(
  crawler: Pick<Crawler, 'cargoLots'>,
  pool: ScrapPool,
  ware: Ware
): Pick<Crawler, 'scrapPool' | 'cargoLots'> {
  return { scrapPool: pool, cargoLots: [...(crawler.cargoLots ?? []), storedLot(ware)] }
}

/** The mech's patch that mounts a crafted System or Module (a chassis never mounts). */
export function installPatch(
  mech: Pick<Mech, 'systems' | 'modules'>,
  ware: Ware
): Partial<Pick<Mech, 'systems' | 'modules'>> | null {
  if (ware.kind === 'system') return { systems: [...mech.systems, ware.slug] }
  if (ware.kind === 'module') return { modules: [...mech.modules, ware.slug] }
  return null
}
