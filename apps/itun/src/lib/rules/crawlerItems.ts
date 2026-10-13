/**
 * crawlerItems — the crawler sheet's non-component helpers (a rules home, not
 * `components/sheet/`). Pure lookups, constants and the bay-repair
 * patch shared by CrawlerSheetItems and CrawlerSheet.
 */

import type { Crawler, ScrapPool } from 'itun-domain/schemas/crawler'
import type { SURefEntity } from 'salvageunion-reference'
import { resolveSystemRef } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'
import { drawFromPool, poolAvailableAtOrAbove } from './crawlerEconomy'

/** Resolve a stored crawler-system slug to its SRD entity. */
export function resolveCrawlerSystem(ref: string): SURefEntity | null {
  return readReference('resolveCrawlerSystem', () => resolveSystemRef(ref), null)
}

/** Bay repair cost: 5 Scrap of crawler TL or higher. */
export const BAY_REPAIR_COST = 5

// The scrap tech-level list has one home, `lib/rules/crawlerEconomy.ts#SCRAP_TLS`,
// beside the pool math that walks it.

/** One crawler bay entry as the crawler record stores it. */
type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/**
 * How much Scrap of the crawler's Tech Level or higher the pool is short of a
 * bay repair: 0 when it can pay. Advisory only — a short pool still repairs and
 * the shortfall is only named on the button.
 */
export function bayRepairShortfall(pool: ScrapPool, crawlerTl: number): number {
  return Math.max(0, BAY_REPAIR_COST - poolAvailableAtOrAbove(pool, crawlerTl))
}

/** The two writes one bay repair makes: the crawler's pool after paying, and the bay's patch. */
export type BayRepairPatch = {
  crawlerPatch: Pick<Crawler, 'scrapPool'>
  bayPatch: Pick<CrawlerBayEntry, 'condition'>
}

/**
 * Repair a Damaged bay: draw 5 Scrap starting at the crawler-TL bucket and
 * spilling into higher buckets, then flip the bay Intact. A short pool spends
 * what it has and the bay still repairs (`partial`).
 */
export function bayRepairPatch(pool: ScrapPool, crawlerTl: number): BayRepairPatch {
  const drawn = drawFromPool(pool, crawlerTl, BAY_REPAIR_COST, { partial: true })
  return { crawlerPatch: { scrapPool: drawn.pool }, bayPatch: { condition: 'intact' } }
}

/** A bay's per-Tech-Level line label as the book prints it: "Tech 3-4". */
const TECH_RANGE = /^Tech (\d+)\s*[-–]\s*(\d+)$/

/**
 * The bay's lines that hold at this crawler's Tech Level: the book's "Tech 1-2
 * / Tech 3-4 / Tech 5-6" ladder (Med Bay, Core Book p.223; Pilot Bay,
 * pp.223-224) narrowed to the rung the crawler stands on. A bay with no ladder
 * has none.
 */
export function bayTechLines<B extends { label?: string }>(
  content: readonly B[],
  crawlerTl: number
): B[] {
  return content.filter((block) => {
    const range = TECH_RANGE.exec(block.label?.trim() ?? '')
    return range !== null && crawlerTl >= Number(range[1]) && crawlerTl <= Number(range[2])
  })
}
