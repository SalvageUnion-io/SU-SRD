/**
 * Crafting Bay rules.
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
 * - Bio-Tech (Tech Level B) costs its Bio-Salvage Value in Bio-Salvage, a
 *   Chimerium counting as 10, and needs a Bio-Crafting Bay (We Were Here
 *   First! p.61, p.10). Nanite-Tech (Tech Level N) costs its Salvage Value in
 *   Active Meld Nanites and needs a Nanite Processing Bay or a Tech 6
 *   Crafting Bay (False Flag p.66). `exoticSalvage.ts` pays for both.
 *
 * This module is PURE: no React, no store, no randomness. The UI
 * (CraftingControl) confirms the quote with the player, then applies
 * `quote.pool` and deposits `craftedLot(item)` into the crawler hold.
 */

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { makeUnitLot } from 'game-domain/schemas/cargoLot'
import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import type { TechLevel } from 'salvageunion-reference/rules'
import { scrapCostFor } from 'salvageunion-reference/rules'
import type { PoolDraw } from './crawlerEconomy'
import { bayGate, drawFromPool, poolAvailableAtOrAbove } from './crawlerEconomy'
import type { ExoticSpend } from './exoticSalvage'
import {
  BIO_CRAFTING_BAY,
  bioAvailable,
  drawActiveNanites,
  drawBio,
  exoticBucket,
  NANITE_PROCESSING_BAY,
} from './exoticSalvage'

/** The minimal shape of a craftable Chassis/System/Module. */
export type CraftableItem = {
  name: string
  /** Tech Level 1–6, or B (Bio-Tech) / N (Nanite-Tech), which no Scrap pays for. */
  techLevel: number | 'B' | 'N'
  salvageValue: number
}

/** True when an item of `itemTl` may be crafted on a Tech-`crawlerTl` crawler (p.222). */
export function craftableAtTl(itemTl: number, crawlerTl: number): boolean {
  return Number.isInteger(itemTl) && itemTl >= 1 && itemTl <= 6 && itemTl <= crawlerTl
}

/** The expansion bays that open Bio and Nanite crafting, operational or not. */
export type CraftBays = { bioCrafting: boolean; naniteProcessing: boolean }

/** Which of the crawler's expansion bays can craft (installed and not Damaged). */
export function craftBaysOf(crawler: Pick<Crawler, 'crawlerBays'>): CraftBays {
  return {
    bioCrafting: bayGate(crawler, BIO_CRAFTING_BAY).operational,
    naniteProcessing: bayGate(crawler, NANITE_PROCESSING_BAY).operational,
  }
}

const NO_CRAFT_BAYS: CraftBays = { bioCrafting: false, naniteProcessing: false }

export type CraftQuote = {
  /** What pays: Scrap, Bio-Salvage (Chimerium at 10), or Active Meld Nanites. */
  currency: 'scrap' | 'bio' | 'nanites'
  /** Cost = the item's Salvage Value (p.244), in `currency`. */
  cost: number
  /** Item TL ≤ crawler TL (p.222), or the Bio/Nanite bay it needs. */
  eligible: boolean
  /** The pool covers `cost` at the item's TL or higher. */
  affordable: boolean
  /** Scrap the pool is short at the item's TL+ (0 when affordable). */
  shortfall: number
  /** Which Tech buckets pay (lowest qualifying first); empty when unaffordable or exotic. */
  draws: PoolDraw[]
  /** What a Bio or Nanite craft spends; empty for Scrap or when unaffordable. */
  spent: ExoticSpend
  /** The pool after paying (unchanged when unaffordable). */
  pool: ScrapPool
}

/**
 * Quote crafting `item` against the crawler's shared scrap pool: cost equals
 * the Salvage Value, paid in Scrap of the item's Tech Level or higher
 * (p.244), drawn from the lowest qualifying bucket upward.
 */
export function craftQuote(
  item: CraftableItem,
  pool: ScrapPool,
  crawlerTl: number,
  bays: CraftBays = NO_CRAFT_BAYS
): CraftQuote {
  const cost = scrapCostFor({
    salvageValue: item.salvageValue,
    techLevel: item.techLevel as TechLevel,
  })
  if (item.techLevel === 'B' || item.techLevel === 'N') {
    const bio = item.techLevel === 'B'
    const drawn = bio ? drawBio(pool, cost) : drawActiveNanites(pool, cost)
    const available = bio ? bioAvailable(pool) : exoticBucket(pool, 'activeNanites')
    return {
      currency: bio ? 'bio' : 'nanites',
      cost,
      eligible: bio ? bays.bioCrafting : bays.naniteProcessing || crawlerTl >= 6,
      affordable: drawn !== null,
      shortfall: Math.max(0, cost - available),
      draws: [],
      spent: drawn?.spent ?? {},
      pool: drawn?.pool ?? pool,
    }
  }
  const eligible = craftableAtTl(item.techLevel, crawlerTl)
  const drawn = drawFromPool(pool, item.techLevel, cost)
  return {
    currency: 'scrap',
    cost,
    eligible,
    affordable: drawn !== null,
    shortfall: Math.max(0, cost - poolAvailableAtOrAbove(pool, item.techLevel)),
    draws: drawn?.draws ?? [],
    spent: {},
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
    typeof item.techLevel === 'number' &&
    Number.isInteger(item.techLevel) &&
    item.techLevel >= 1 &&
    item.techLevel <= 6
      ? item.techLevel
      : undefined
  return makeUnitLot(item.name, {
    cat: 'SYSTEM',
    units: Math.max(1, item.salvageValue),
    ...(tl !== undefined ? { tl } : {}),
  })
}
