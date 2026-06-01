/**
 * Scrap economy rule utilities (REQ-014, REQ-015).
 *
 * Salvage Union uses a tiered scrap currency: each tech level (TL1–TL6) is a
 * distinct denomination. Scrap at a higher tech level is worth more, but the
 * conversion rates are not directly in the reference data — items carry their
 * own `salvageValue` which is the canonical cost/sell price in "Tech N Scrap"
 * units (i.e., TL-2 Scrap for a TL-2 item, etc.).
 *
 * Crawler tech-level upgrades use the `upgradeCost` field from
 * salvageunion-reference `crawler-tech-levels.json` (SRD p.218).
 *
 * All functions are pure — no side effects, no async, no React.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { ScrapableItem, TechLevel } from './types'

/**
 * Returns the sell (salvage) value of an item in units of its own tech level's
 * scrap. This is the `salvageValue` field from the reference data.
 *
 * Example: a TL-2 system with salvageValue 3 yields 3 TL-2 Scrap when salvaged.
 */
export function salvageValueFor(item: ScrapableItem): number {
  return item.salvageValue
}

/**
 * Returns the buy (install) cost of an item in units of its own tech level's
 * scrap. Per SRD rules the purchase cost equals the salvage value.
 *
 * SRD reference: Workshop Manual p.162–163 ("Salvage and Scrap" rules).
 */
export function scrapCostFor(item: ScrapableItem): number {
  // Cost equals salvage value — items are bought and sold at the same scrap price.
  return item.salvageValue
}

/**
 * Returns the cost in scrap to upgrade a crawler from `fromTL` to `toTL`.
 *
 * Upgrade costs come from `salvageunion-reference` `crawler-tech-levels.json`
 * (SRD p.218). The `upgradeCost` multiplier on the *current* tech level record
 * gives the cost to move to the next level.
 *
 * Only sequential upgrades (fromTL → fromTL+1) are directly priced in the
 * data. Jumping multiple tiers sums each intermediate upgrade cost.
 *
 * Returns `null` when:
 * - `fromTL` equals `toTL` (no upgrade needed)
 * - `fromTL` is already at maximum (TL6 has null upgradeCost in the data)
 * - any intermediate tech-level record is not found in the dataset
 *
 * Callers should treat `null` as "cannot determine cost" and surface a
 * manual-review warning rather than blocking.
 */
export function tierUpgradeCost(fromTL: TechLevel, toTL: TechLevel): number | null {
  if (fromTL === toTL) return 0
  if (fromTL > toTL) return null // downgrade; use a soft warning instead

  let total = 0
  for (let tl = fromTL; tl < toTL; tl++) {
    const record = SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)
    if (!record || record.upgradeCost === null) return null
    total += record.upgradeCost
  }
  return total
}
