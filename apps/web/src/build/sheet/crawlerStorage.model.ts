/**
 * What of a crawler's Storage Bay its sheet shows (`CrawlerStorage`): the
 * Scrap Pool and the Crawler Hold. Read leaves what is empty out (ruleset
 * §1.2); Edit shows both, since Edit can fill them.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import { scrapPoolBucket } from '../../lib/cargo/cargoTransfer'

export function storageShows(
  crawler: Crawler,
  readOnly: boolean
): { pool: boolean; hold: boolean } {
  const pool = crawler.scrapPool ?? {}
  const poolEmpty = NUMERIC_TECH_LEVELS.every((t) => scrapPoolBucket(pool, t) === 0)
  const holdEmpty = (crawler.cargoLots ?? []).length === 0
  return { pool: !readOnly || !poolEmpty, hold: !readOnly || !holdEmpty }
}
