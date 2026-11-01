import { isNumericTechLevel } from 'salvageunion-reference/rules'
/**
 * Crafting Bay rules.
 *
 * Salvage Union Core Book p.222: a Crafting Bay crafts any Mech Chassis,
 * System or Module of the crawler's Tech Level or lower.
 */

/** True when an item of `itemTl` may be crafted on a Tech-`crawlerTl` crawler (p.222). */
export function craftableAtTl(itemTl: number, crawlerTl: number): boolean {
  return isNumericTechLevel(itemTl) && itemTl <= crawlerTl
}
