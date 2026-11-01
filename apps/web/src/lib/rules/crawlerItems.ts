/**
 * crawlerItems — the crawler sheet's non-component helpers (a rules home, not
 * `build/sheet/`). Pure lookups, constants and the bay-repair
 * patch shared by CrawlerSheetItems and CrawlerSheet.
 */

import type { Crawler, ScrapPool } from 'game-domain/schemas/crawler'
import type { RefEntity } from 'salvageunion-reference'
import { resolveSystemRef } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'
import { drawFromPool } from './crawlerEconomy'

/** Resolve a stored crawler-system slug to its SRD entity. */
export function resolveCrawlerSystem(ref: string): RefEntity | null {
  return readReference('resolveCrawlerSystem', () => resolveSystemRef(ref), null)
}

/** Bay repair cost: 5 Scrap of crawler TL or higher. */
export const BAY_REPAIR_COST = 5

/** One crawler bay entry as the crawler record stores it. */
type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

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
