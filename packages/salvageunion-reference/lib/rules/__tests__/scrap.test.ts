/**
 * Unit tests for scrap.ts — scrap economy utilities.
 *
 * Uses REAL data from salvageunion-reference for crawler tech level upgrade
 * costs, and hand-crafted fixtures for item-level tests.
 */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import {
  crawlerTypeDowntimeUpgradeBonus,
  crawlerUpkeepCost,
  nextTierUpgradeCost,
  scrapCostFor,
  tierUpgradeCost,
} from '../scrap'
import type { ScrapableItem } from '../types'

// ---------------------------------------------------------------------------
// Fixtures — hand-crafted items for isolation
// ---------------------------------------------------------------------------

const tl1Item: ScrapableItem = { salvageValue: 2, techLevel: 1 }
const tl3Item: ScrapableItem = { salvageValue: 5, techLevel: 3 }
const tl6Item: ScrapableItem = { salvageValue: 12, techLevel: 6 }
const zeroValueItem: ScrapableItem = { salvageValue: 0, techLevel: 1 }

describe('scrapCostFor', () => {
  it('returns the salvageValue field — items are bought and sold at one price', () => {
    expect(scrapCostFor(tl1Item)).toBe(2)
    expect(scrapCostFor(tl3Item)).toBe(5)
    expect(scrapCostFor(tl6Item)).toBe(12)
  })

  it('returns 0 for a zero-value item', () => {
    expect(scrapCostFor(zeroValueItem)).toBe(0)
  })

  it('works with real system data from salvageunion-reference', () => {
    const system = SalvageUnionReference.Systems.getByName('.50 Cal Machine Gun')
    expect(system).toBeDefined()
    if (!system) return
    const item: ScrapableItem = {
      salvageValue: system.salvageValue,
      techLevel: system.techLevel as 1,
    }
    expect(scrapCostFor(item)).toBe(system.salvageValue)
  })
})

describe('tierUpgradeCost', () => {
  it('returns 0 when fromTL equals toTL (no upgrade needed)', () => {
    expect(tierUpgradeCost(1, 1)).toBe(0)
    expect(tierUpgradeCost(3, 3)).toBe(0)
    expect(tierUpgradeCost(6, 6)).toBe(0)
  })

  it('returns null for a downgrade (fromTL > toTL)', () => {
    expect(tierUpgradeCost(3, 1)).toBeNull()
    expect(tierUpgradeCost(6, 5)).toBeNull()
  })

  it('returns the upgrade cost for a single-step upgrade from real data', () => {
    // crawler-tech-levels.json: all levels have upgradeCost 30
    const result = tierUpgradeCost(1, 2)
    expect(result).toBe(30)
  })

  it('sums costs for multi-step upgrades using real data', () => {
    // TL1→2 = 30, TL2→3 = 30, total = 60
    const result = tierUpgradeCost(1, 3)
    expect(result).toBe(60)
  })

  it('returns null when upgrading from TL6 (max level has null upgradeCost)', () => {
    // TL6 record has upgradeCost: null in the dataset
    const result = tierUpgradeCost(6, 7 as 6) // 7 coerced to test null path
    expect(result).toBeNull()
  })

  it('verifies crawler tech level data is present for all levels 1-5', () => {
    for (let tl = 1; tl <= 5; tl++) {
      const record = SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)
      expect(record).toBeDefined()
      expect(record?.upgradeCost).not.toBeNull()
    }
  })
})

describe('crawler tier costs from crawler-tech-levels.json (p.218)', () => {
  it("reads each tier's Upkeep and next-tier Upgrade cost", () => {
    for (const tl of [1, 2, 3, 4, 5, 6]) {
      const tier = SalvageUnionReference.CrawlerTechLevels.find((r) => r.techLevel === tl)
      expect(crawlerUpkeepCost(tl)).toBe(tier?.upkeepCost ?? -1)
      expect(nextTierUpgradeCost(tl)).toBe(tier === undefined ? -1 : tier.upgradeCost)
    }
  })

  it('has no Upgrade above Tech 6 and nothing for an unknown tier', () => {
    expect(nextTierUpgradeCost(6)).toBeNull()
    expect(nextTierUpgradeCost(0)).toBeNull()
    expect(crawlerUpkeepCost(0)).toBe(0)
  })
})

describe("Exceptional Engineering (p.216), from the type's stored mutations", () => {
  it('the Engineering Crawler pays 2 less Upkeep and gets 2 free Upgrade Pool Scrap', () => {
    for (const tl of [1, 2, 3, 4, 5, 6]) {
      expect(crawlerUpkeepCost(tl, 'engineering')).toBe(crawlerUpkeepCost(tl) - 2)
    }
    expect(crawlerTypeDowntimeUpgradeBonus('engineering')).toBe(2)
  })

  it('every other type, no type and an unknown type change nothing', () => {
    for (const type of ['battle', undefined, 'not-a-crawler']) {
      expect(crawlerUpkeepCost(3, type)).toBe(crawlerUpkeepCost(3))
      expect(crawlerTypeDowntimeUpgradeBonus(type)).toBe(0)
    }
  })
})
