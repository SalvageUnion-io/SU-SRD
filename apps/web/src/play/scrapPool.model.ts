/**
 * A crawler's Scrap Pool as words and chips (r8 D1, D2): what Craft · Trade
 * heads with and the crawler card shows, by that name. Pure, and small, so
 * Play's unit boxes read it without the Downtime models.
 */

import type { ScrapPool } from 'game-domain/schemas/crawler'
import { NUMERIC_TECH_LEVELS } from 'salvageunion-reference/rules'
import { scrapPoolBucket } from '../lib/cargo/cargoTransfer'

/** The pool by Tech Level, lowest first (`T1 | 3`), empty levels left out. */
export function poolChips(pool: ScrapPool | undefined): { label: string; value: string }[] {
  return NUMERIC_TECH_LEVELS.flatMap((tl) => {
    const count = scrapPoolBucket(pool ?? {}, tl)
    return count > 0 ? [{ label: `T${tl}`, value: String(count) }] : []
  })
}

/** The pool on one line, `T1 3 · T2 1`; `none` when it holds no Scrap. */
export function poolText(pool: ScrapPool | undefined, none: string): string {
  const chips = poolChips(pool)
  return chips.length === 0 ? none : chips.map((c) => `${c.label} ${c.value}`).join(' · ')
}
