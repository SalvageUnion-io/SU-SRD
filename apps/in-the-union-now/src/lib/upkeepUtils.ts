import { computeScrapTranslation } from './crawlerUtils'
import type { CrawlerRow } from '../types/common'

export type CrawlerScrap = {
  tl1: number
  tl2: number
  tl3: number
  tl4: number
  tl5: number
  tl6: number
}

export type ScrapConversion = {
  fromTL: number
  toTL: number
  sourceConsumed: number
  targetAmount: number
}

export type UpkeepAffordability =
  | { canAfford: true; directPay: true }
  | { canAfford: true; directPay: false; conversions: ScrapConversion[] }
  | { canAfford: false }

/** Extract scrap fields from a crawler row into a typed object. */
export function extractScrap(crawler: CrawlerRow): CrawlerScrap {
  return {
    tl1: crawler.scrap_tl1,
    tl2: crawler.scrap_tl2,
    tl3: crawler.scrap_tl3,
    tl4: crawler.scrap_tl4,
    tl5: crawler.scrap_tl5,
    tl6: crawler.scrap_tl6,
  }
}

/** Get scrap amount at a specific tech level. */
export function getScrapAtTL(scrap: CrawlerScrap, tl: number): number {
  return scrap[`tl${tl}` as keyof CrawlerScrap] ?? 0
}

/**
 * Compute total TL1-equivalent scrap across all levels.
 * Each unit of TL N is worth N TL1 units.
 */
export function totalScrapValue(scrap: CrawlerScrap): number {
  return (
    scrap.tl1 * 1 + scrap.tl2 * 2 + scrap.tl3 * 3 + scrap.tl4 * 4 + scrap.tl5 * 5 + scrap.tl6 * 6
  )
}

/**
 * Check if crawler can afford upkeep at its tech level.
 * Upkeep is always 5 scrap at the crawler's TL.
 *
 * Returns:
 * - directPay: true if enough scrap at the exact TL
 * - conversions: if not enough at exact TL, the cheapest conversion path from higher TLs
 * - canAfford: false if not enough even with conversions
 */
export function canAffordUpkeep(
  scrap: CrawlerScrap,
  upkeepCost: number,
  crawlerTL: number
): UpkeepAffordability {
  const available = getScrapAtTL(scrap, crawlerTL)

  // Can pay directly
  if (available >= upkeepCost) {
    return { canAfford: true, directPay: true }
  }

  // Try to find conversions from higher TLs first (most efficient)
  const shortfall = upkeepCost - available
  const conversions = computeUpkeepConversions(scrap, shortfall, crawlerTL)

  if (conversions) {
    return { canAfford: true, directPay: false, conversions }
  }

  return { canAfford: false }
}

/**
 * Find the cheapest set of conversions to cover a shortfall at target TL.
 * Strategy: convert from highest TL down first (each unit is worth more).
 */
function computeUpkeepConversions(
  scrap: CrawlerScrap,
  shortfall: number,
  targetTL: number
): ScrapConversion[] | null {
  const conversions: ScrapConversion[] = []
  let remaining = shortfall

  // Try higher TLs first (most efficient conversion), then lower TLs
  const tlOrder = [6, 5, 4, 3, 2, 1].filter((tl) => tl !== targetTL)

  for (const fromTL of tlOrder) {
    if (remaining <= 0) break
    const availableSource = getScrapAtTL(scrap, fromTL)
    if (availableSource <= 0) continue

    const result = computeScrapTranslation(fromTL, targetTL, availableSource)
    if (!result) continue

    if (result.targetAmount >= remaining) {
      // We can cover the remaining shortfall with a partial conversion
      // Find minimum source needed
      const neededTarget = remaining
      // Work backwards: how much source do we need for `neededTarget` units at targetTL?
      const tl1Needed = neededTarget * targetTL
      const sourceNeeded = Math.ceil(tl1Needed / fromTL)

      if (sourceNeeded > availableSource) continue

      const partialResult = computeScrapTranslation(fromTL, targetTL, sourceNeeded)
      if (partialResult && partialResult.targetAmount >= neededTarget) {
        conversions.push({
          fromTL,
          toTL: targetTL,
          sourceConsumed: partialResult.sourceConsumed,
          targetAmount: partialResult.targetAmount,
        })
        remaining -= partialResult.targetAmount
      }
    } else {
      // Use all available source
      conversions.push({
        fromTL,
        toTL: targetTL,
        sourceConsumed: result.sourceConsumed,
        targetAmount: result.targetAmount,
      })
      remaining -= result.targetAmount
    }
  }

  return remaining <= 0 ? conversions : null
}

/**
 * Compute total payment in crawler-TL equivalent from manual contributions.
 * Each unit of TL N contributed is worth N TL1-units.
 * Result is floor-divided by crawlerTL to get equivalent units.
 */
export function computeTotalPayment(
  contributions: Record<number, number>,
  crawlerTL: number
): number {
  const tl1Total = Object.entries(contributions).reduce(
    (sum, [tl, amount]) => sum + Number(tl) * amount,
    0
  )
  return Math.floor(tl1Total / crawlerTL)
}

/**
 * Convert contribution map { 3: 5, 1: 2 } to DB field deductions { scrap_tl3: 5, scrap_tl1: 2 }.
 * Filters out zero entries.
 */
export function contributionsToDeductions(
  contributions: Record<number, number>
): Record<string, number> {
  const deductions: Record<string, number> = {}
  for (const [tl, amount] of Object.entries(contributions)) {
    if (amount > 0) {
      deductions[`scrap_tl${tl}`] = amount
    }
  }
  return deductions
}

/**
 * Check if total scrap (TL1-equivalent) can cover minimum upkeep (5 at crawlerTL).
 * Minimum TL1-equivalent needed = 5 * crawlerTL.
 */
export function canAffordMinimumUpkeep(scrap: CrawlerScrap, crawlerTL: number): boolean {
  return totalScrapValue(scrap) >= 5 * crawlerTL
}

/**
 * Compute scrap deductions and upgrade pool increase for paying upkeep.
 * Returns the fields to update on the crawler row.
 */
export function computeUpkeepPayment(
  scrap: CrawlerScrap,
  upkeepCost: number,
  crawlerTL: number,
  affordability: UpkeepAffordability
): {
  scrapDeductions: Record<string, number>
  upgradePoolIncrease: number
} {
  if (!affordability.canAfford) {
    // Can't afford — no deductions, no upgrade pool increase
    return { scrapDeductions: {}, upgradePoolIncrease: 0 }
  }

  const scrapDeductions: Record<string, number> = {}

  if (affordability.directPay) {
    // Simple: deduct upkeepCost from the crawler's TL
    scrapDeductions[`scrap_tl${crawlerTL}`] = upkeepCost
  } else {
    // Need conversions first — deduct conversion sources
    // The conversions produce target TL scrap, then we deduct from that
    let totalConverted = 0
    for (const conv of affordability.conversions) {
      const sourceField = `scrap_tl${conv.fromTL}`
      scrapDeductions[sourceField] = (scrapDeductions[sourceField] ?? 0) + conv.sourceConsumed
      totalConverted += conv.targetAmount
    }

    // Deduct what we already have at target TL
    const existingAtTL = getScrapAtTL(scrap, crawlerTL)
    const fromExisting = Math.min(existingAtTL, upkeepCost)
    if (fromExisting > 0) {
      scrapDeductions[`scrap_tl${crawlerTL}`] = fromExisting
    }

    // Converted scrap covers the rest, but we don't add then deduct —
    // the net effect is we just consumed the conversion sources.
    // The targetAmount from conversions minus what's needed goes back.
    // But since translate_scrap is a separate RPC, we handle this differently:
    // We actually need to track the net at target TL.
    // Net gain at target TL = totalConverted - (upkeepCost - fromExisting)
    const neededFromConversion = upkeepCost - fromExisting
    const surplusConverted = totalConverted - neededFromConversion

    if (surplusConverted > 0) {
      // Add surplus back — net deduction at target TL is negative (we gain)
      // But since we can't do a negative deduction, we adjust:
      // Total deducted at target TL = fromExisting - surplusConverted
      const netDeduction = fromExisting - surplusConverted
      if (netDeduction > 0) {
        scrapDeductions[`scrap_tl${crawlerTL}`] = netDeduction
      } else if (netDeduction < 0) {
        // We actually gain scrap at this TL — this means we need to ADD
        // We'll handle this as a negative deduction that the caller interprets
        scrapDeductions[`scrap_tl${crawlerTL}`] = netDeduction
      } else {
        delete scrapDeductions[`scrap_tl${crawlerTL}`]
      }
    }
  }

  return { scrapDeductions, upgradePoolIncrease: upkeepCost }
}
