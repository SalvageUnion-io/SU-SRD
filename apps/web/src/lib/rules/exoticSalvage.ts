/**
 * Expansion salvage: Bio-Salvage, Chimerium and Meld Nanites.
 *
 * None of these is Scrap of a Tech Level, so each has its own bucket beside
 * the six Tech buckets of the crawler's pool (`ScrapPoolSchema`):
 *
 * - **Bio-Salvage** (B): 1 Cargo Slot, trades for 1 Tech 1 Scrap, cannot
 *   craft or repair ordinary tech (Core Book p.275); crafts Bio-Tech at its
 *   Bio-Salvage Value in a Bio-Crafting Bay (We Were Here First! p.61).
 * - **Chimerium**: 1 Cargo Slot, trades as Tech 6 Scrap, and counts as 10
 *   Bio-Salvage to craft Bio-Tech (WWHF pp.9-10).
 * - **Inert Meld Nanites** (N): a pile trades for 1 Tech 1 Scrap and cannot
 *   craft or repair. Processing them is a Downtime action in a Nanite
 *   Processing Bay: a d20 per pile, and a 20 is an Active Meld Nanite (False
 *   Flag p.66).
 * - **Active Meld Nanites**: trade as Tech 6 Scrap and craft Nanite-Tech at
 *   its Salvage Value, in a Nanite Processing Bay or a Tech 6 Crafting Bay
 *   (False Flag p.66).
 *
 * Processing reads "to find Active Meld Nanites within them" as using the
 * pile up: every pile processed is spent, and a 20 leaves an Active Meld
 * Nanite in its place. Otherwise the same dust could be processed again every
 * Downtime.
 *
 * PURE: no React, no store. The d20 is injected.
 */

import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import { bayGate } from './crawlerEconomy'

export type ExoticKey = 'bio' | 'chimerium' | 'inertNanites' | 'activeNanites'

export type ExoticResource = {
  key: ExoticKey
  /** The Tech Level of the one Scrap each piece trades for. */
  tradeTl: 1 | 6
}

/** The four, in the order the sheet shows them. */
export const EXOTIC_RESOURCES: readonly ExoticResource[] = [
  { key: 'bio', tradeTl: 1 },
  { key: 'chimerium', tradeTl: 6 },
  { key: 'inertNanites', tradeTl: 1 },
  { key: 'activeNanites', tradeTl: 6 },
]

/** Bio-Salvage one Chimerium counts as when crafting Bio-Tech (WWHF p.10). */
const CHIMERIUM_BIO_VALUE = 10

export const BIO_CRAFTING_BAY = 'bio-crafting-bay'
export const NANITE_PROCESSING_BAY = 'nanite-processing-bay'

/** The die that finds an Active Meld Nanite in a pile (False Flag p.66). */
const ACTIVE_ON = 20

/** Read one resource. Absent reads as 0 (schema contract). */
export function exoticBucket(pool: ScrapPool, key: ExoticKey): number {
  return pool[key] ?? 0
}

/** A new pool with `delta` applied to one resource, floored at 0. */
export function addToExotic(pool: ScrapPool, key: ExoticKey, delta: number): ScrapPool {
  return { ...pool, [key]: Math.max(0, exoticBucket(pool, key) + delta) }
}

/** True when the pool holds any of the four. */
export function hasExotic(pool: ScrapPool): boolean {
  return EXOTIC_RESOURCES.some((r) => exoticBucket(pool, r.key) > 0)
}

/** The resource's definition. */
function exoticResource(key: ExoticKey): ExoticResource {
  return EXOTIC_RESOURCES.find((r) => r.key === key) ?? (EXOTIC_RESOURCES[0] as ExoticResource)
}

// ---------------------------------------------------------------------------
// Trade
// ---------------------------------------------------------------------------

/**
 * Trade `count` pieces of a resource for Scrap: each piece is one Scrap of
 * its trade Tech Level. Null when the bucket is short or `count` is not a
 * positive whole number.
 */
export function tradeExotic(
  pool: ScrapPool,
  key: ExoticKey,
  count: number
): { pool: ScrapPool; tl: 1 | 6; scrap: number } | null {
  if (!Number.isInteger(count) || count <= 0) return null
  if (exoticBucket(pool, key) < count) return null
  const { tradeTl } = exoticResource(key)
  const tlKey = `tl${tradeTl}` as const
  const next = addToExotic(pool, key, -count)
  return { pool: { ...next, [tlKey]: (next[tlKey] ?? 0) + count }, tl: tradeTl, scrap: count }
}

// ---------------------------------------------------------------------------
// Process Inert Meld Nanites (False Flag p.66)
// ---------------------------------------------------------------------------

export type NaniteProcessing = {
  /** Piles processed (every Inert pile in the pool). */
  processed: number
  /** Active Meld Nanites found: the 20s. */
  found: number
  /** Each pile's d20, in order. */
  rolls: number[]
  pool: ScrapPool
}

/** The crawler's Nanite Processing Bay: installed, and not Damaged. */
export function naniteProcessingGate(crawler: Pick<Crawler, 'crawlerBays'>) {
  return bayGate(crawler, NANITE_PROCESSING_BAY)
}

/**
 * Process every Inert pile: a d20 each, a 20 an Active Meld Nanite. Each pile
 * is spent whatever it rolls (see the header).
 */
export function processNanites(pool: ScrapPool, rollD20: () => number): NaniteProcessing {
  const processed = exoticBucket(pool, 'inertNanites')
  const rolls = Array.from({ length: processed }, () => rollD20())
  const found = rolls.filter((r) => r >= ACTIVE_ON).length
  const next = addToExotic(addToExotic(pool, 'inertNanites', -processed), 'activeNanites', found)
  return { processed, found, rolls, pool: next }
}

// ---------------------------------------------------------------------------
// Paying for Bio-Tech and Nanite-Tech
// ---------------------------------------------------------------------------

/** What a Bio or Nanite craft spends, by resource. */
export type ExoticSpend = Partial<Record<ExoticKey, number>>

/** Bio-Salvage the pool can put toward Bio-Tech: its Bio-Salvage plus 10 a Chimerium. */
export function bioAvailable(pool: ScrapPool): number {
  return exoticBucket(pool, 'bio') + CHIMERIUM_BIO_VALUE * exoticBucket(pool, 'chimerium')
}

/**
 * Pay `cost` Bio-Salvage: Bio-Salvage first, then whole Chimerium for the
 * rest (a Chimerium is spent whole; the book makes no change for it). Null
 * when the pool is short.
 */
export function drawBio(
  pool: ScrapPool,
  cost: number
): { pool: ScrapPool; spent: ExoticSpend } | null {
  if (bioAvailable(pool) < cost) return null
  const bio = Math.min(exoticBucket(pool, 'bio'), cost)
  const chimerium = Math.ceil((cost - bio) / CHIMERIUM_BIO_VALUE)
  const spent: ExoticSpend = {}
  if (bio > 0) spent.bio = bio
  if (chimerium > 0) spent.chimerium = chimerium
  return {
    pool: addToExotic(addToExotic(pool, 'bio', -bio), 'chimerium', -chimerium),
    spent,
  }
}

/** Pay `cost` Active Meld Nanites. Null when the pool is short. */
export function drawActiveNanites(
  pool: ScrapPool,
  cost: number
): { pool: ScrapPool; spent: ExoticSpend } | null {
  if (exoticBucket(pool, 'activeNanites') < cost) return null
  return {
    pool: addToExotic(pool, 'activeNanites', -cost),
    spent: cost > 0 ? { activeNanites: cost } : {},
  }
}
