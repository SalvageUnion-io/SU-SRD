/**
 * Union Crawler economy actions (design-review R-4).
 *
 * Salvage Union Core Book p.218-223 — the Downtime economy loop around the
 * crawler's shared scrap pool:
 *
 * - Upkeep (p.218): 5 Scrap of the crawler's Tech Level per Downtime. Paid
 *   Upkeep credits the Upgrade Pool in full. Failing to pay triggers a d20
 *   roll on the Crawler Deterioration Table (p.219).
 * - Deterioration Table (p.219): 20 nothing; 11-19 lose 5 SP; 6-10 the player
 *   CHOOSES a Bay to damage; 2-5 a random Bay is damaged; 1 both (5 SP + a
 *   random Bay).
 * - Upgrading (p.218-219): when the Upgrade Pool reaches the tech level's
 *   Upgrade Value (30× TL Scrap, `crawler-tech-levels.json`) the crawler may
 *   move to the next Tech Level; damaged Bays are repaired during the upgrade.
 *   Additional Scrap may be spent into the pool to accelerate.
 * - Trading Scrap (p.223): each piece of Scrap is worth its Tech Level and
 *   trades at fixed, exact-value rates (4× T1 → 1× T4; 3× T2 → 2× T3, …).
 *   A Damaged Trading Bay blocks Scrap trading and the availability roll.
 * - Trading Bay Table (p.223): d20 — 20 a Chassis; 11-19 a System AND a
 *   Module; 6-10 a System; 2-5 a Module; 1 nothing. Wares are always one Tech
 *   Level above the crawler's.
 *
 * Pool draws follow the app's established convention (bay repair, S12):
 * scrap of the crawler's Tech Level *or higher* may pay a TL-denominated
 * cost, drawn from the lowest qualifying bucket upward.
 *
 * This module is PURE: no React, no store, no real randomness — the d20 (and
 * the random-Bay pick) are injected via the shared `Roll` type so every
 * function is deterministic in tests. Per ADR-007 the deterministic outcomes
 * (SP loss, the random-Bay index) are computed for the caller to auto-apply;
 * the 6-10 "choose a Bay" band only raises `requiresPlayerChoice` — this
 * module never picks for the player.
 */

import { tierUpgradeCost } from 'salvageunion-reference/rules'
import { addToScrapPool, scrapPoolBucket } from '../cargo/cargoTransfer'
import { resolveCrawlerBay } from '../crawlerRefs'
import type { Crawler, ScrapPool } from '../schemas/crawler'
import { DOWNTIME_UPKEEP_SCRAP } from './downtime'
import type { Roll } from './heatCheck'
import type { TechLevel } from './types'

/**
 * The numeric scrap tech levels (pool bucket keys are tl1..tl6).
 *
 * Exported as the ONE home for this list: the crawler sheet's bucket steppers
 * and the exchange dialog's TL pickers used to each keep a private copy, so a
 * seventh tech level would have had to be found in three places.
 */
export const SCRAP_TLS = [1, 2, 3, 4, 5, 6] as const

/** Tech levels with a sequential upgrade above them, and that next level. */
const UPGRADABLE_TLS = [1, 2, 3, 4, 5] as const
const NEXT_TL: Record<(typeof UPGRADABLE_TLS)[number], TechLevel> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
}

// ---------------------------------------------------------------------------
// Pool draws (TL-or-higher, lowest bucket first)
// ---------------------------------------------------------------------------

/** One bucket's contribution to a pool draw. */
export type PoolDraw = { tl: number; count: number }

/** Total scrap available at `tl` or any higher bucket. */
export function poolAvailableAtOrAbove(pool: ScrapPool, tl: number): number {
  return SCRAP_TLS.filter((t) => t >= tl).reduce((sum, t) => sum + scrapPoolBucket(pool, t), 0)
}

/** A completed pool draw: the pool afterwards, and which buckets paid. */
export type PoolDrawResult = { pool: ScrapPool; draws: PoolDraw[] }

export type DrawFromPoolOptions = {
  /**
   * Spend whatever the qualifying buckets hold instead of refusing when they
   * cannot cover the full amount — the bay-repair convention (S12), where a
   * short pool still repairs and the shortfall is only surfaced on the button.
   *
   * Upkeep, Upgrade-Pool contributions and every other economy draw are
   * all-or-nothing and leave this off.
   */
  partial?: boolean
}

/**
 * Draw `amount` scrap from the pool starting at the `tl` bucket and spilling
 * into higher buckets (the app's TL-or-higher payment convention). Returns
 * the new pool plus the per-bucket draws, or `null` when the pool can't
 * cover the full amount — unless `{ partial: true }`, which spends what it
 * can and therefore never returns `null`.
 */
export function drawFromPool(
  pool: ScrapPool,
  tl: number,
  amount: number,
  options: DrawFromPoolOptions & { partial: true }
): PoolDrawResult
export function drawFromPool(
  pool: ScrapPool,
  tl: number,
  amount: number,
  options?: DrawFromPoolOptions
): PoolDrawResult | null
export function drawFromPool(
  pool: ScrapPool,
  tl: number,
  amount: number,
  options: DrawFromPoolOptions = {}
): PoolDrawResult | null {
  if (amount <= 0) return { pool, draws: [] }
  if (!options.partial && poolAvailableAtOrAbove(pool, tl) < amount) return null
  let next = pool
  let remaining = amount
  const draws: PoolDraw[] = []
  for (const t of SCRAP_TLS) {
    if (t < tl || remaining <= 0) continue
    const take = Math.min(scrapPoolBucket(next, t), remaining)
    if (take > 0) {
      next = addToScrapPool(next, t, -take)
      remaining -= take
      draws.push({ tl: t, count: take })
    }
  }
  return { pool: next, draws }
}

// ---------------------------------------------------------------------------
// Upkeep (p.218)
// ---------------------------------------------------------------------------

/** Upkeep cost: 5 Scrap of the crawler's Tech Level per Downtime. */
export const UPKEEP_SCRAP = DOWNTIME_UPKEEP_SCRAP

export type UpkeepPayment = {
  /** The pool after the draw. */
  pool: ScrapPool
  /** Which buckets paid (lowest qualifying first). */
  draws: PoolDraw[]
  /** Scrap credited to the Upgrade Pool (paid Upkeep credits in full). */
  upgradeCredit: number
}

/** How much scrap the pool is short of this Downtime's Upkeep (0 = covered). */
export function upkeepShortfall(pool: ScrapPool, crawlerTl: number): number {
  return Math.max(0, UPKEEP_SCRAP - poolAvailableAtOrAbove(pool, crawlerTl))
}

/**
 * Pay Upkeep: draw 5 Scrap (crawler TL or higher) from the pool. The full
 * payment credits the Upgrade Pool (p.218). Returns `null` when the pool
 * can't cover it — the caller offers the Deterioration roll instead.
 */
export function payUpkeep(pool: ScrapPool, crawlerTl: number): UpkeepPayment | null {
  const drawn = drawFromPool(pool, crawlerTl, UPKEEP_SCRAP)
  if (!drawn) return null
  return { pool: drawn.pool, draws: drawn.draws, upgradeCredit: UPKEEP_SCRAP }
}

/**
 * Voluntary Upgrade-Pool contribution (p.218 "spend additional Scrap towards
 * your Upgrade Pool"): draws `amount` Scrap (crawler TL or higher) from the
 * pool; the caller adds `amount` to `upgradePool`. Null when unaffordable.
 */
export function contributeToUpgradePool(
  pool: ScrapPool,
  crawlerTl: number,
  amount: number
): { pool: ScrapPool; draws: PoolDraw[] } | null {
  if (amount <= 0) return null
  return drawFromPool(pool, crawlerTl, amount)
}

// ---------------------------------------------------------------------------
// Crawler Deterioration Table (p.219)
// ---------------------------------------------------------------------------

export type DeteriorationOutcome =
  | 'safe' // 20 — chugs along
  | 'lose-sp' // 11-19 — lose 5 SP
  | 'choose-bay' // 6-10 — player chooses a Bay to damage
  | 'random-bay' // 2-5 — a random Bay is damaged
  | 'sp-and-random-bay' // 1 — lose 5 SP AND a random Bay is damaged

/** SP lost on the 11-19 and 1 bands. */
export const DETERIORATION_SP_LOSS = 5

/** Maps a Deterioration Table d20 roll to its outcome band (p.219). */
export function deteriorationOutcome(roll: number): DeteriorationOutcome {
  if (roll <= 1) return 'sp-and-random-bay'
  if (roll <= 5) return 'random-bay'
  if (roll <= 10) return 'choose-bay'
  if (roll <= 19) return 'lose-sp'
  return 'safe'
}

export type DeteriorationEffect = {
  /** The d20 rolled on the table. */
  roll: number
  outcome: DeteriorationOutcome
  /** SP lost (0 or DETERIORATION_SP_LOSS). */
  spLoss: number
  /** SP after the loss, floored at 0. */
  nextSP: number
  /**
   * Index into `crawlerBays` of the randomly-picked Bay to damage (the 2-5
   * and 1 bands — "chosen at random" is mechanical, so it auto-applies).
   * Null when the band picks no Bay or the crawler has no Bays.
   */
  randomBayIndex: number | null
  /** True on 6-10: the PLAYER chooses which Bay to mark Damaged (ADR-007). */
  requiresPlayerChoice: boolean
}

type DeteriorationInput = {
  /** Current SP at the moment of the failed Upkeep. */
  currentSP: number
  /** How many Bays the crawler has (the random pick rolls 1..bayCount). */
  bayCount: number
  /** Injectable roller — used for the d20 AND the random Bay pick. */
  roll: Roll
}

/**
 * Rolls the Crawler Deterioration Table (failed Upkeep, p.219) and computes
 * the deterministic effect. The random-Bay bands pick uniformly across ALL
 * Bays (rules: "a Bay chosen at random" — an already-Damaged pick simply
 * stays Damaged).
 */
export function performDeterioration({
  currentSP,
  bayCount,
  roll,
}: DeteriorationInput): DeteriorationEffect {
  const tableRoll = roll(20)
  const outcome = deteriorationOutcome(tableRoll)

  const losesSp = outcome === 'lose-sp' || outcome === 'sp-and-random-bay'
  const picksBay = outcome === 'random-bay' || outcome === 'sp-and-random-bay'
  const spLoss = losesSp ? DETERIORATION_SP_LOSS : 0

  return {
    roll: tableRoll,
    outcome,
    spLoss,
    nextSP: Math.max(0, currentSP - spLoss),
    randomBayIndex: picksBay && bayCount > 0 ? roll(bayCount) - 1 : null,
    requiresPlayerChoice: outcome === 'choose-bay',
  }
}

// ---------------------------------------------------------------------------
// Upgrading the crawler (p.218-219)
// ---------------------------------------------------------------------------

export type CrawlerUpgradeQuote = {
  fromTl: number
  toTl: number
  /** Upgrade Value in TL Scrap (30 per crawler-tech-levels.json). */
  cost: number
  /** upgradePool >= cost. */
  affordable: boolean
  /** Upgrade Pool left after paying the cost (unclamped math, min 0 shown). */
  remainingPool: number
}

/**
 * Quote the next sequential Tech-Level upgrade against the Upgrade Pool.
 * Returns `null` at Tech 6 (no further upgrade) or when the upgrade cost is
 * not determinable from the reference data.
 */
export function crawlerUpgradeQuote(
  crawlerTl: number,
  upgradePool: number
): CrawlerUpgradeQuote | null {
  if (crawlerTl < 1 || crawlerTl >= 6) return null
  // Membership narrow (not a cast): non-integer inputs fall out here exactly
  // as tierUpgradeCost would have resolved them — no record, null cost.
  const fromTl = UPGRADABLE_TLS.find((tl) => tl === crawlerTl)
  if (fromTl === undefined) return null
  const cost = tierUpgradeCost(fromTl, NEXT_TL[fromTl])
  if (cost === null) return null
  return {
    fromTl: crawlerTl,
    toTl: crawlerTl + 1,
    cost,
    affordable: upgradePool >= cost,
    remainingPool: Math.max(0, upgradePool - cost),
  }
}

// ---------------------------------------------------------------------------
// Trading Scrap — fixed-rate TL exchange (p.223)
// ---------------------------------------------------------------------------

/** Each piece of Scrap is worth its Tech Level (p.223). */
export function scrapValue(tl: number): number {
  return tl
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/**
 * The smallest number of `fromTl` pieces that converts EXACTLY into whole
 * `toTl` pieces (the fixed rates cannot be bartered or split): toTl/gcd.
 * E.g. T2→T3 steps by 3 (3× T2 → 2× T3); T1→T4 steps by 4.
 */
export function exchangeStep(fromTl: number, toTl: number): number {
  return toTl / gcd(fromTl, toTl)
}

/**
 * How many `toTl` pieces `fromCount`× `fromTl` Scrap converts into at the
 * fixed equal-value rate — or `null` when the exchange isn't exact (the
 * Trading Bay never makes change) or the inputs are degenerate.
 */
export function convertedCount(fromTl: number, fromCount: number, toTl: number): number | null {
  if (fromCount <= 0 || fromTl === toTl) return null
  if (!SCRAP_TLS.includes(fromTl as (typeof SCRAP_TLS)[number])) return null
  if (!SCRAP_TLS.includes(toTl as (typeof SCRAP_TLS)[number])) return null
  const value = scrapValue(fromTl) * fromCount
  return value % toTl === 0 ? value / toTl : null
}

/**
 * Apply a fixed-rate Scrap exchange to the pool: `fromCount`× `fromTl` out,
 * the equal-value `toTl` count in. Null when the exchange isn't exact or the
 * `fromTl` bucket is short.
 */
export function convertScrap(
  pool: ScrapPool,
  fromTl: number,
  fromCount: number,
  toTl: number
): { pool: ScrapPool; toCount: number } | null {
  const toCount = convertedCount(fromTl, fromCount, toTl)
  if (toCount === null) return null
  if (scrapPoolBucket(pool, fromTl) < fromCount) return null
  const next = addToScrapPool(addToScrapPool(pool, fromTl, -fromCount), toTl, toCount)
  return { pool: next, toCount }
}

// ---------------------------------------------------------------------------
// Trading Bay Table — Downtime availability roll (p.223)
// ---------------------------------------------------------------------------

export type TradingAvailability =
  | 'chassis' // 20
  | 'system-and-module' // 11-19
  | 'system' // 6-10
  | 'module' // 2-5
  | 'nothing' // 1

/** Display text per band — mirrors the SRD Trading Bay Table (p.223). */
export const TRADING_AVAILABILITY_LABEL: Record<TradingAvailability, string> = {
  chassis: 'An Intact Mech Chassis is available for trade.',
  'system-and-module': 'An Intact System and an Intact Module are available for trade.',
  system: 'An Intact System is available for trade.',
  module: 'An Intact Module is available for trade.',
  nothing: 'Nothing is available for trade during this Downtime.',
}

/** Maps a Trading Bay Table d20 roll to its availability band (p.223). */
export function tradingAvailability(roll: number): TradingAvailability {
  if (roll <= 1) return 'nothing'
  if (roll <= 5) return 'module'
  if (roll <= 10) return 'system'
  if (roll <= 19) return 'system-and-module'
  return 'chassis'
}

/**
 * Wares for trade are always ONE Tech Level above the crawler's (p.223),
 * capped at Tech 6 (the highest tech level that exists).
 */
export function tradingSourceTl(crawlerTl: number): number {
  return Math.min(crawlerTl + 1, 6)
}

export type TradingRollResult = {
  roll: number
  availability: TradingAvailability
  /** The Tech Level of whatever is available (crawler TL + 1, capped). */
  sourceTl: number
}

/** Roll the Trading Bay Table for this Downtime (once per Downtime, p.223). */
export function performTradingRoll({
  crawlerTl,
  roll,
}: {
  crawlerTl: number
  roll: Roll
}): TradingRollResult {
  const tableRoll = roll(20)
  return {
    roll: tableRoll,
    availability: tradingAvailability(tableRoll),
    sourceTl: tradingSourceTl(crawlerTl),
  }
}

// ---------------------------------------------------------------------------
// Bay gate (Trading Bay damaged = no trading, p.223)
// ---------------------------------------------------------------------------

export type BayGate = {
  /** The named bay is installed on the crawler. */
  present: boolean
  /** The installed bay is currently Damaged. */
  damaged: boolean
  /** present && !damaged. */
  operational: boolean
}

/**
 * Presence + condition gate for a named bay (e.g. 'Trading Bay'): a Damaged
 * Trading Bay blocks Scrap trading and the availability roll entirely.
 */
export function bayGate(crawler: Pick<Crawler, 'crawlerBays'>, bayName: string): BayGate {
  const entry = (crawler.crawlerBays ?? []).find(
    (bay) => resolveCrawlerBay(bay.bayRef)?.name === bayName
  )
  const present = entry !== undefined
  const damaged = present && (entry.condition ?? 'intact') === 'damaged'
  return { present, damaged, operational: present && !damaged }
}
