/**
 * Scrap economy rule utilities.
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

import { SalvageUnionReference } from '../index'
import type { CrawlerMutationInput } from './creation'
import { resolveCrawlerRef } from './resolveRefs'
import type { ScrapableItem, TechLevel } from './types'

/**
 * Returns the buy (install) cost of an item in units of its own tech level's
 * scrap. Per SRD rules the purchase cost equals the salvage value.
 *
 * SRD reference: Core Book p.244 ("To craft a Mech Chassis, System, or Module
 * you must spend an amount of Scrap equal to Salvage Value").
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
  // Upgrade costs are only defined for the numeric crawler tiers (1–6). The
  // non-numeric equipment tiers ('B'/'N') have no sequential upgrade path.
  if (typeof fromTL !== 'number' || typeof toTL !== 'number') return null
  if (fromTL > toTL) return null // downgrade; use a soft warning instead

  let total = 0
  for (let tl = fromTL; tl < toTL; tl++) {
    const record = SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)
    if (!record || record.upgradeCost === null) return null
    total += record.upgradeCost
  }
  return total
}

/**
 * The sum of the crawler type `typeRef`'s stored mutations of `kind`. An
 * absent ref, an unresolvable one or a catalog not yet loaded sums to 0.
 */
function crawlerTypeMutationTotal(
  typeRef: string | undefined,
  kind: CrawlerMutationInput['type']
): number {
  if (!typeRef) return 0
  let mutations: readonly CrawlerMutationInput[] | undefined
  try {
    mutations = resolveCrawlerRef(typeRef)?.mutations
  } catch {
    return 0
  }
  return (mutations ?? []).filter((m) => m.type === kind).reduce((sum, m) => sum + m.value, 0)
}

/**
 * Upkeep for a crawler at `tl`: Scrap of that Tech Level or higher per
 * Downtime, from the tier's `upkeepCost` in `crawler-tech-levels.json`
 * (SRD p.218), less its type's `upkeep_reduction` mutations (Engineering
 * −2, p.216), never below 0. 0 when no tier matches.
 */
export function crawlerUpkeepCost(tl: number, typeRef?: string): number {
  const base =
    SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)?.upkeepCost ?? 0
  return Math.max(0, base - crawlerTypeMutationTotal(typeRef, 'upkeep_reduction'))
}

/**
 * Free Scrap the crawler type `typeRef` adds to the Upgrade Pool at the start
 * of each Downtime (Engineering +2, p.216); 0 for every other type.
 */
export function crawlerTypeDowntimeUpgradeBonus(typeRef?: string): number {
  return crawlerTypeMutationTotal(typeRef, 'downtime_upgrade_pool')
}

/**
 * The cost to upgrade a crawler at `tl` to the next Tech Level: that tier's
 * `upgradeCost` (SRD p.218). `null` at the top tier (the data's null) or for
 * a Tech Level with no tier.
 */
export function nextTierUpgradeCost(tl: number): number | null {
  return (
    SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)?.upgradeCost ?? null
  )
}
