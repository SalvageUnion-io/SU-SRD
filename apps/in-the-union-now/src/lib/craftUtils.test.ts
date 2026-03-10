import { describe, it, expect } from 'bun:test'
import {
  getCraftCost,
  getCraftableEntities,
  canAffordCraft,
  computeCraftDeduction,
  getAvailableScrapAfterCrafts,
} from './craftUtils'
import type { CraftReceipt } from './craftUtils'
import type { SURefEntity } from 'salvageunion-reference'
import type { CrawlerRow } from '../types/common'
import type { CrawlerScrap } from './upkeepUtils'

function makeCrawler(overrides: Partial<CrawlerRow> = {}): CrawlerRow {
  return {
    id: 'crawler-1',
    user_id: 'user-1',
    name: 'Test Crawler',
    tech_level: 3,
    scrap_tl1: 10,
    scrap_tl2: 5,
    scrap_tl3: 3,
    scrap_tl4: 0,
    scrap_tl5: 0,
    scrap_tl6: 0,
    notes: null,
    tag: null,
    active: true,
    image_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as CrawlerRow
}

function makeEntity(overrides: Record<string, unknown> = {}): SURefEntity {
  return { id: 'test', name: 'Test', ...overrides } as unknown as SURefEntity
}

describe('getCraftCost', () => {
  it('returns salvage value for an entity with salvageValue', () => {
    expect(getCraftCost(makeEntity({ salvageValue: 5 }))).toBe(5)
  })

  it('returns 0 for entity without salvageValue', () => {
    expect(getCraftCost(makeEntity())).toBe(0)
  })

  it('returns 0 for entity with salvageValue of 0', () => {
    expect(getCraftCost(makeEntity({ salvageValue: 0 }))).toBe(0)
  })
})

describe('getCraftableEntities', () => {
  it('returns entities filtered by crawler TL for systems', () => {
    const result = getCraftableEntities('systems', 1)
    // All returned entities should have TL <= 1 or non-numeric TL
    for (const e of result) {
      const tl = 'techLevel' in e ? e.techLevel : undefined
      if (typeof tl === 'number') {
        expect(tl).toBeLessThanOrEqual(1)
      }
    }
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns more entities at higher TL', () => {
    const tl1 = getCraftableEntities('systems', 1)
    const tl3 = getCraftableEntities('systems', 3)
    expect(tl3.length).toBeGreaterThanOrEqual(tl1.length)
  })

  it('returns entities for modules schema', () => {
    const result = getCraftableEntities('modules', 3)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns entities for chassis schema', () => {
    const result = getCraftableEntities('chassis', 3)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('canAffordCraft', () => {
  it('returns true when scrap at TL is sufficient', () => {
    const scrap: CrawlerScrap = { tl1: 10, tl2: 5, tl3: 3, tl4: 0, tl5: 0, tl6: 0 }
    expect(canAffordCraft(scrap, 5, 1)).toBe(true)
  })

  it('returns false when scrap at TL is insufficient', () => {
    const scrap: CrawlerScrap = { tl1: 2, tl2: 5, tl3: 3, tl4: 0, tl5: 0, tl6: 0 }
    expect(canAffordCraft(scrap, 5, 1)).toBe(false)
  })

  it('returns true when cost is exactly available', () => {
    const scrap: CrawlerScrap = { tl1: 5, tl2: 0, tl3: 0, tl4: 0, tl5: 0, tl6: 0 }
    expect(canAffordCraft(scrap, 5, 1)).toBe(true)
  })

  it('returns true when cost is 0', () => {
    const scrap: CrawlerScrap = { tl1: 0, tl2: 0, tl3: 0, tl4: 0, tl5: 0, tl6: 0 }
    expect(canAffordCraft(scrap, 0, 1)).toBe(true)
  })

  it('checks scrap at the correct TL', () => {
    const scrap: CrawlerScrap = { tl1: 0, tl2: 0, tl3: 10, tl4: 0, tl5: 0, tl6: 0 }
    expect(canAffordCraft(scrap, 5, 3)).toBe(true)
    expect(canAffordCraft(scrap, 5, 1)).toBe(false)
  })
})

describe('computeCraftDeduction', () => {
  it('returns deduction with correct TL for entity with techLevel', () => {
    const result = computeCraftDeduction(makeEntity({ salvageValue: 5, techLevel: 2 }))
    expect(result).toEqual({ field: 'scrap_tl2', amount: 5, tl: 2 })
  })

  it('defaults to TL 1 for entity without techLevel', () => {
    const result = computeCraftDeduction(makeEntity({ salvageValue: 3 }))
    expect(result).toEqual({ field: 'scrap_tl1', amount: 3, tl: 1 })
  })

  it('defaults to TL 1 for entity with non-numeric techLevel', () => {
    const result = computeCraftDeduction(makeEntity({ salvageValue: 4, techLevel: 'B' }))
    expect(result).toEqual({ field: 'scrap_tl1', amount: 4, tl: 1 })
  })

  it('returns null for entity with no salvage value', () => {
    expect(computeCraftDeduction(makeEntity())).toBeNull()
  })

  it('returns null for entity with 0 salvage value', () => {
    expect(computeCraftDeduction(makeEntity({ salvageValue: 0 }))).toBeNull()
  })
})

describe('getAvailableScrapAfterCrafts', () => {
  it('returns full scrap when no receipt', () => {
    const crawler = makeCrawler()
    const result = getAvailableScrapAfterCrafts(crawler, undefined)
    expect(result).toEqual({ tl1: 10, tl2: 5, tl3: 3, tl4: 0, tl5: 0, tl6: 0 })
  })

  it('returns full scrap when receipt has no crafted items', () => {
    const crawler = makeCrawler()
    const receipt: CraftReceipt = { crafted_items: [] }
    const result = getAvailableScrapAfterCrafts(crawler, receipt)
    expect(result).toEqual({ tl1: 10, tl2: 5, tl3: 3, tl4: 0, tl5: 0, tl6: 0 })
  })

  it('deducts crafted items from correct TL', () => {
    const crawler = makeCrawler({ scrap_tl1: 10, scrap_tl2: 8 })
    const receipt: CraftReceipt = {
      crafted_items: [
        { schema_name: 'systems', ref_id: 'sys-1', name: 'Gun', scrap_cost: 3, scrap_tl: 1 },
        { schema_name: 'modules', ref_id: 'mod-1', name: 'Mod', scrap_cost: 2, scrap_tl: 2 },
      ],
    }
    const result = getAvailableScrapAfterCrafts(crawler, receipt)
    expect(result.tl1).toBe(7) // 10 - 3
    expect(result.tl2).toBe(6) // 8 - 2
  })

  it('clamps scrap to 0 (never goes negative)', () => {
    const crawler = makeCrawler({ scrap_tl1: 2 })
    const receipt: CraftReceipt = {
      crafted_items: [
        { schema_name: 'systems', ref_id: 's1', name: 'A', scrap_cost: 5, scrap_tl: 1 },
      ],
    }
    const result = getAvailableScrapAfterCrafts(crawler, receipt)
    expect(result.tl1).toBe(0)
  })

  it('accumulates multiple crafts at the same TL', () => {
    const crawler = makeCrawler({ scrap_tl2: 10 })
    const receipt: CraftReceipt = {
      crafted_items: [
        { schema_name: 'systems', ref_id: 's1', name: 'A', scrap_cost: 3, scrap_tl: 2 },
        { schema_name: 'systems', ref_id: 's2', name: 'B', scrap_cost: 4, scrap_tl: 2 },
      ],
    }
    const result = getAvailableScrapAfterCrafts(crawler, receipt)
    expect(result.tl2).toBe(3) // 10 - 3 - 4
  })
})
