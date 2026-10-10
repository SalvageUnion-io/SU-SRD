/**
 * A Game's crawler as the Mediator's surfaces read it: the Mediator
 * Dashboard's Crawler minor, and the Game page's Crew & seats card and upkeep
 * line (docs/architecture/mediator-dashboard.md Q6, Q7, Q11).
 */

import { crawlerMaxSP, resolvePool } from 'salvageunion-reference/rules'
import { parseCrawlerTechLevel } from '../../lib/crawlerLevel'
import { CrawlerSchema } from '../../lib/schemas/crawler'

/** What the minor shows of a crawler. */
export type CrawlerReading = {
  /** The id its live sheet is addressed by. */
  id: string
  name: string
  sp: number
  maxSP: number
  techLevel: number | null
  bays: number
  baysIntact: number
  /** Scrap of the crawler's own tech level, for Upkeep. */
  scrapAtTl: number
}

/** A listing row (`entities.listForGame`) as the minor reads it, or null. */
export function readCrawler(row: { appId: string | null; body: unknown }): CrawlerReading | null {
  const parsed = CrawlerSchema.safeParse(row.body)
  if (!parsed.success) return null
  const crawler = parsed.data
  const maxSP = crawlerMaxSP(crawler)
  const bays = crawler.crawlerBays ?? []
  const techLevel = parseCrawlerTechLevel(crawler.techLevel) ?? null
  const pool = crawler.scrapPool as Record<string, number | undefined> | undefined
  return {
    id: row.appId ?? crawler.id,
    name: crawler.name,
    sp: resolvePool(crawler.currentSP, maxSP),
    maxSP,
    techLevel,
    bays: bays.length,
    baysIntact: bays.filter((b) => (b.condition ?? 'intact') === 'intact').length,
    scrapAtTl: techLevel === null ? 0 : (pool?.[`tl${techLevel}`] ?? 0),
  }
}
