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
import type { ScrapableItem, TechLevel } from './types';
/**
 * Returns the buy (install) cost of an item in units of its own tech level's
 * scrap. Per SRD rules the purchase cost equals the salvage value.
 *
 * SRD reference: Core Book p.244 ("To craft a Mech Chassis, System, or Module
 * you must spend an amount of Scrap equal to Salvage Value").
 */
export declare function scrapCostFor(item: ScrapableItem): number;
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
export declare function tierUpgradeCost(fromTL: TechLevel, toTL: TechLevel): number | null;
