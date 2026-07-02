/**
 * Crafting Bay rules (design-review R-7).
 *
 * Salvage Union Core Book p.222 + p.244:
 * - A Crafting Bay lets you craft any Mech Chassis, System, or Module of the
 *   crawler's Tech Level or lower (p.222). A Damaged Crafting Bay can craft
 *   nothing until repaired.
 * - Crafting costs Scrap equal to the item's Salvage Value, "of its Tech
 *   Level or higher" (p.244) — the app's standard TL-or-higher pool draw,
 *   lowest qualifying bucket first (same convention as bay repair / Upkeep).
 * - Crafting happens during Downtime only — the honor system (ADR-001), so
 *   nothing here gates on a Downtime flag.
 *
 * This module is PURE: no React, no store, no randomness. The UI
 * (CraftingControl) confirms the quote with the player, then applies
 * `quote.pool` and deposits `craftedLot(item)` into the crawler hold.
 */

import type { CargoLot } from '../schemas/cargoLot'
import { makeUnitLot } from '../schemas/cargoLot'
import type { ScrapPool } from '../schemas/crawler'
import { drawFromPool, poolAvailableAtOrAbove } from './crawlerEconomy'
import type { PoolDraw } from './crawlerEconomy'
import { scrapCostFor } from './scrap'
import type { TechLevel } from './types'

/** The bay whose presence + Intact condition gates crafting (p.222). */
export const CRAFTING_BAY = 'Crafting Bay'

/** The minimal shape of a craftable Chassis/System/Module. */
export type CraftableItem = {
  name: string
  /** Numeric Tech Level 1–6 (Bio/Nanite gear has no scrap denomination). */
  techLevel: number
  salvageValue: number
}

/** True when an item of `itemTl` may be crafted on a Tech-`crawlerTl` crawler (p.222). */
export function craftableAtTl(itemTl: number, crawlerTl: number): boolean {
  return Number.isInteger(itemTl) && itemTl >= 1 && itemTl <= 6 && itemTl <= crawlerTl
}

export type CraftQuote = {
  /** Scrap cost = the item's Salvage Value (p.244). */
  cost: number
  /** Item TL ≤ crawler TL (p.222). */
  eligible: boolean
  /** The pool covers `cost` at the item's TL or higher. */
  affordable: boolean
  /** Scrap the pool is short at the item's TL+ (0 when affordable). */
  shortfall: number
  /** Which buckets pay (lowest qualifying first); empty when unaffordable. */
  draws: PoolDraw[]
  /** The pool after paying (unchanged when unaffordable). */
  pool: ScrapPool
}

/**
 * Quote crafting `item` against the crawler's shared scrap pool: cost equals
 * the Salvage Value, paid in Scrap of the item's Tech Level or higher
 * (p.244), drawn from the lowest qualifying bucket upward.
 */
export function craftQuote(item: CraftableItem, pool: ScrapPool, crawlerTl: number): CraftQuote {
  const cost = scrapCostFor({
    salvageValue: item.salvageValue,
    techLevel: item.techLevel as TechLevel,
  })
  const eligible = craftableAtTl(item.techLevel, crawlerTl)
  const drawn = drawFromPool(pool, item.techLevel, cost)
  return {
    cost,
    eligible,
    affordable: drawn !== null,
    shortfall: Math.max(0, cost - poolAvailableAtOrAbove(pool, item.techLevel)),
    draws: drawn?.draws ?? [],
    pool: drawn?.pool ?? pool,
  }
}

/**
 * The freshly-crafted item as an Intact unit cargo lot for the crawler hold.
 * Slots = Salvage Value (p.246 — same accounting as salvaged items), floored
 * at 1 so a lot never costs 0.
 */
export function craftedLot(item: CraftableItem): CargoLot {
  const tl =
    Number.isInteger(item.techLevel) && item.techLevel >= 1 && item.techLevel <= 6
      ? item.techLevel
      : undefined
  return makeUnitLot(item.name, {
    cat: 'SYSTEM',
    units: Math.max(1, item.salvageValue),
    ...(tl !== undefined ? { tl } : {}),
  })
}
