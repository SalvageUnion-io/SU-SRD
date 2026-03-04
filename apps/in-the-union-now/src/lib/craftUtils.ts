import { SalvageUnionReference, getSalvageValue } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { filterByTechLevel } from './tradeUtils'
import { extractScrap, getScrapAtTL } from './upkeepUtils'
import type { CrawlerScrap } from './upkeepUtils'
import type { CrawlerRow } from '../types/common'

export type CraftedItem = {
  schema_name: 'chassis' | 'systems' | 'modules'
  ref_id: string
  name: string
  scrap_cost: number
  scrap_tl: number
}

export type CraftReceipt = {
  crafted_items: CraftedItem[]
}

/** Get the scrap cost for crafting an entity (= its salvage value) */
export function getCraftCost(entity: SURefEntity): number {
  return getSalvageValue(entity) ?? 0
}

/** Get craftable entities for a given schema, filtered by crawler TL */
export function getCraftableEntities(
  schemaName: 'chassis' | 'systems' | 'modules',
  crawlerTL: number
): SURefEntity[] {
  const all = SalvageUnionReference.findAllIn(schemaName, () => true) as SURefEntity[]
  return filterByTechLevel(
    all as (SURefEntity & { techLevel?: number | string })[],
    crawlerTL
  ) as SURefEntity[]
}

/** Check if the crawler can afford to craft an item at a specific TL */
export function canAffordCraft(scrap: CrawlerScrap, cost: number, itemTL: number): boolean {
  if (cost <= 0) return true
  return getScrapAtTL(scrap, itemTL) >= cost
}

/**
 * Compute the scrap deduction field/amount for crafting an item.
 * Cost is paid in scrap at the item's TL.
 */
export function computeCraftDeduction(
  entity: SURefEntity
): { field: string; amount: number; tl: number } | null {
  const cost = getCraftCost(entity)
  if (cost <= 0) return null

  const tl = 'techLevel' in entity && typeof entity.techLevel === 'number' ? entity.techLevel : 1
  return { field: `scrap_tl${tl}`, amount: cost, tl }
}

/** Get available scrap for display, accounting for already-crafted items this downtime */
export function getAvailableScrapAfterCrafts(
  crawler: CrawlerRow,
  receipt: CraftReceipt | undefined
): CrawlerScrap {
  const scrap = extractScrap(crawler)
  if (!receipt) return scrap

  // Deduct already-crafted costs from available scrap
  for (const item of receipt.crafted_items) {
    const key = `tl${item.scrap_tl}` as keyof CrawlerScrap
    scrap[key] = Math.max(0, scrap[key] - item.scrap_cost)
  }
  return scrap
}
