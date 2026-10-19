/**
 * A Game's crawler as the Game page's Crew & seats card reads it
 * (docs/architecture/play.md §16).
 */

import { CrawlerSchema } from 'game-domain/schemas/crawler'
import { crawlerMaxSP, parseCrawlerTechLevel, resolvePool } from 'salvageunion-reference/rules'

/** What the card shows of a crawler. */
export type CrawlerReading = {
  /** The id its live sheet is addressed by. */
  id: string
  name: string
  sp: number
  maxSP: number
  techLevel: number | null
}

/** A listing row (`entities.listForGame`) as the card reads it, or null. */
export function readCrawler(row: { appId: string | null; body: unknown }): CrawlerReading | null {
  const parsed = CrawlerSchema.safeParse(row.body)
  if (!parsed.success) return null
  const crawler = parsed.data
  const maxSP = crawlerMaxSP(crawler)
  const techLevel = parseCrawlerTechLevel(crawler.techLevel) ?? null
  return {
    id: row.appId ?? crawler.id,
    name: crawler.name,
    sp: resolvePool(crawler.currentSP, maxSP),
    maxSP,
    techLevel,
  }
}

/**
 * The crawler's vitals, label first: `TL | 3`, `SP | 14/20`. The Game page's
 * crew seats read only these: a crawler never lists its count of bays (owner's
 * call, 2026-10-14).
 */
export function crawlerVitals(
  crawler: CrawlerReading
): { label: string; value: string; chip: 'rank' | 'measure' }[] {
  return [
    ...(crawler.techLevel === null
      ? []
      : [{ label: 'TL', value: String(crawler.techLevel), chip: 'rank' as const }]),
    { label: 'SP', value: `${crawler.sp}/${crawler.maxSP}`, chip: 'measure' as const },
  ]
}
