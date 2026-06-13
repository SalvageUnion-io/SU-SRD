/**
 * crawlerLevel — resolve a pilot's EFFECTIVE Crawler Tech Level for choice
 * scaling (Slice E).
 *
 * Some choice caps scale with a crawler's Tech Level — e.g. the Custom Sniper
 * Rifle's Modification choice ("at each Tech Level you may select an additional
 * Modification"), encoded as `constraints.scalesWithField: "techLevel"`. To
 * resolve such a cap a pilot needs an effective Tech Level:
 *
 *   1. If the pilot is linked to a crawler (pilot-to-crawler SoftLink), use that
 *      crawler's techLevel.
 *   2. Otherwise fall back to the pilot's manual `crawlerLevel`.
 *   3. Otherwise undefined (no cap resolves — unbounded, unchanged behaviour).
 *
 * A crawler's `techLevel` is stored as a slug like "tech-3"; this parses out the
 * numeric level.
 */

import type { Crawler } from './schemas/crawler'
import type { Pilot } from './schemas/pilot'

/**
 * Parse a crawler techLevel slug (e.g. "tech-3") to its numeric level (3).
 * Returns undefined when no digits are present.
 */
export function parseCrawlerTechLevel(techLevel: string): number | undefined {
  const digits = techLevel.replace(/[^0-9]/g, '')
  if (digits.length === 0) {
    return undefined
  }
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Compute the effective Crawler Tech Level for a pilot.
 *
 * A linked crawler's techLevel always wins over the manual fallback. When the
 * pilot has no linked crawler the manual `crawlerLevel` is used; when neither is
 * present the result is undefined (caps stay unbounded).
 *
 * @param pilot          the pilot
 * @param linkedCrawler  the crawler the pilot is linked to (resolved by the
 *                       caller via SoftLinks + entityStore), or null/undefined
 *                       when the pilot has no associated crawler.
 */
export function resolveEffectiveCrawlerLevel(
  pilot: Pick<Pilot, 'crawlerLevel'>,
  linkedCrawler: Pick<Crawler, 'techLevel'> | null | undefined
): number | undefined {
  if (linkedCrawler) {
    const fromCrawler = parseCrawlerTechLevel(linkedCrawler.techLevel)
    if (fromCrawler !== undefined) {
      return fromCrawler
    }
  }
  return pilot.crawlerLevel
}
