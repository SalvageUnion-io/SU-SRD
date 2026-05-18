import { describe, expect, test } from 'bun:test'
import {
  extractScrap,
  getScrapAtTL,
  totalScrapValue,
  canAffordUpkeep,
  computeUpkeepPayment,
  computeTotalPayment,
  contributionsToDeductions,
  canAffordMinimumUpkeep,
} from './upkeepUtils'
import type { CrawlerScrap } from './upkeepUtils'
import type { CrawlerRow } from '../types/common'

// --- Test helpers ---

function makeScrap(overrides: Partial<CrawlerScrap> = {}): CrawlerScrap {
  return { tl1: 0, tl2: 0, tl3: 0, tl4: 0, tl5: 0, tl6: 0, ...overrides }
}

const BASE_CRAWLER = {
  id: 'crawler-1',
  crawler_ref: 'some-crawler',
  name: 'Test Crawler',
  tag: null,
  notes: null,
  tech_level: 1,
  max_sp: 20,
  current_sp: 20,
  upgrade_pool: 0,
  upkeep: 5,
  scrap_tl1: 0,
  scrap_tl2: 0,
  scrap_tl3: 0,
  scrap_tl4: 0,
  scrap_tl5: 0,
  scrap_tl6: 0,
  bay_npcs: {},
  user_id: 'user-1',
  active: true,
  visible: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
} satisfies Partial<CrawlerRow>

function makeCrawlerRow(overrides: Partial<CrawlerRow> = {}): CrawlerRow {
  return { ...BASE_CRAWLER, ...overrides } as CrawlerRow
}

// --- Tests ---

describe('extractScrap', () => {
  test('extracts scrap fields from crawler row', () => {
    const crawler = makeCrawlerRow({
      scrap_tl1: 10,
      scrap_tl2: 5,
      scrap_tl3: 3,
    })

    const scrap = extractScrap(crawler)

    expect(scrap.tl1).toBe(10)
    expect(scrap.tl2).toBe(5)
    expect(scrap.tl3).toBe(3)
    expect(scrap.tl4).toBe(0)
    expect(scrap.tl5).toBe(0)
    expect(scrap.tl6).toBe(0)
  })
})

describe('getScrapAtTL', () => {
  test('returns correct amount for each TL', () => {
    const scrap = makeScrap({ tl1: 10, tl3: 7 })
    expect(getScrapAtTL(scrap, 1)).toBe(10)
    expect(getScrapAtTL(scrap, 2)).toBe(0)
    expect(getScrapAtTL(scrap, 3)).toBe(7)
  })
})

describe('totalScrapValue', () => {
  test('returns 0 for empty scrap', () => {
    expect(totalScrapValue(makeScrap())).toBe(0)
  })

  test('computes weighted sum', () => {
    const scrap = makeScrap({ tl1: 10, tl2: 5, tl3: 3 })
    // 10*1 + 5*2 + 3*3 = 10 + 10 + 9 = 29
    expect(totalScrapValue(scrap)).toBe(29)
  })

  test('high TL scrap is worth more', () => {
    const scrap = makeScrap({ tl6: 1 })
    expect(totalScrapValue(scrap)).toBe(6)
  })
})

describe('canAffordUpkeep', () => {
  test('direct pay when enough scrap at crawler TL', () => {
    const scrap = makeScrap({ tl2: 10 })
    const result = canAffordUpkeep(scrap, 5, 2)

    expect(result.canAfford).toBe(true)
    expect(result).toHaveProperty('directPay', true)
  })

  test('direct pay with exact amount', () => {
    const scrap = makeScrap({ tl1: 5 })
    const result = canAffordUpkeep(scrap, 5, 1)

    expect(result.canAfford).toBe(true)
    expect(result).toHaveProperty('directPay', true)
  })

  test('cannot afford with no scrap at all', () => {
    const scrap = makeScrap()
    const result = canAffordUpkeep(scrap, 5, 1)

    expect(result.canAfford).toBe(false)
  })

  test('can afford via conversion from higher TL', () => {
    // Need 5 TL1, have 0 TL1 but 5 TL2 (worth 10 TL1)
    const scrap = makeScrap({ tl2: 5 })
    const result = canAffordUpkeep(scrap, 5, 1)

    expect(result.canAfford).toBe(true)
    expect(result).toHaveProperty('directPay', false)
    if (!result.canAfford || result.directPay) throw new Error('Expected conversion')
    expect(result.conversions.length).toBeGreaterThan(0)
    expect(result.conversions[0]!.fromTL).toBe(2)
    expect(result.conversions[0]!.toTL).toBe(1)
  })

  test('cannot afford when total scrap value is insufficient', () => {
    // Need 5 TL3 (worth 15 TL1), have only 2 TL1 (worth 2 TL1)
    const scrap = makeScrap({ tl1: 2 })
    const result = canAffordUpkeep(scrap, 5, 3)

    expect(result.canAfford).toBe(false)
  })

  test('partial existing + conversion', () => {
    // Need 5 TL1, have 3 TL1 + 2 TL2 (shortfall = 2, TL2 converts to 4 TL1)
    const scrap = makeScrap({ tl1: 3, tl2: 2 })
    const result = canAffordUpkeep(scrap, 5, 1)

    expect(result.canAfford).toBe(true)
    if (!result.canAfford || result.directPay) throw new Error('Expected conversion')
    // Should convert some TL2 to cover the shortfall
    expect(result.conversions[0]!.fromTL).toBe(2)
  })
})

describe('computeUpkeepPayment', () => {
  test('direct pay deducts from crawler TL', () => {
    const scrap = makeScrap({ tl2: 10 })
    const affordability = canAffordUpkeep(scrap, 5, 2)

    const payment = computeUpkeepPayment(scrap, 5, 2, affordability)

    expect(payment.scrapDeductions['scrap_tl2']).toBe(5)
    expect(payment.upgradePoolIncrease).toBe(5)
  })

  test('cannot afford returns no deductions, no upgrade increase', () => {
    const scrap = makeScrap()
    const affordability = canAffordUpkeep(scrap, 5, 1)

    const payment = computeUpkeepPayment(scrap, 5, 1, affordability)

    expect(payment.scrapDeductions).toEqual({})
    expect(payment.upgradePoolIncrease).toBe(0)
  })

  test('upgrade pool increase equals upkeep cost on success', () => {
    const scrap = makeScrap({ tl1: 20 })
    const affordability = canAffordUpkeep(scrap, 5, 1)
    const payment = computeUpkeepPayment(scrap, 5, 1, affordability)

    expect(payment.upgradePoolIncrease).toBe(5)
  })
})

describe('computeTotalPayment', () => {
  test('single TL at crawler TL returns exact amount', () => {
    // 5 units of TL2 contributed, crawler is TL2 → 5*2/2 = 5
    expect(computeTotalPayment({ 2: 5 }, 2)).toBe(5)
  })

  test('higher TL contributes more value', () => {
    // 1 unit of TL6, crawler is TL3 → floor(6/3) = 2
    expect(computeTotalPayment({ 6: 1 }, 3)).toBe(2)
  })

  test('mixed TL contributions sum correctly', () => {
    // 3 TL1 + 2 TL3, crawler TL2 → floor((3*1 + 2*3) / 2) = floor(9/2) = 4
    expect(computeTotalPayment({ 1: 3, 3: 2 }, 2)).toBe(4)
  })

  test('floors fractional results', () => {
    // 1 TL1, crawler TL3 → floor(1/3) = 0
    expect(computeTotalPayment({ 1: 1 }, 3)).toBe(0)
  })

  test('empty contributions returns 0', () => {
    expect(computeTotalPayment({}, 2)).toBe(0)
  })

  test('zero contributions are harmless', () => {
    expect(computeTotalPayment({ 1: 0, 3: 0 }, 1)).toBe(0)
  })
})

describe('contributionsToDeductions', () => {
  test('maps TL numbers to scrap_tl fields', () => {
    expect(contributionsToDeductions({ 3: 5 })).toEqual({ scrap_tl3: 5 })
  })

  test('filters out zero entries', () => {
    expect(contributionsToDeductions({ 1: 0, 2: 3, 3: 0 })).toEqual({ scrap_tl2: 3 })
  })

  test('handles multiple TLs', () => {
    expect(contributionsToDeductions({ 1: 2, 4: 1, 6: 3 })).toEqual({
      scrap_tl1: 2,
      scrap_tl4: 1,
      scrap_tl6: 3,
    })
  })

  test('empty contributions returns empty object', () => {
    expect(contributionsToDeductions({})).toEqual({})
  })
})

describe('canAffordMinimumUpkeep', () => {
  test('sufficient scrap at same TL', () => {
    const scrap = makeScrap({ tl2: 5 })
    // Need 5 * 2 = 10 TL1-eq, have 5*2 = 10
    expect(canAffordMinimumUpkeep(scrap, 2)).toBe(true)
  })

  test('sufficient scrap from mixed TLs', () => {
    // Need 5 * 3 = 15 TL1-eq, have 10*1 + 1*6 = 16
    const scrap = makeScrap({ tl1: 10, tl6: 1 })
    expect(canAffordMinimumUpkeep(scrap, 3)).toBe(true)
  })

  test('insufficient scrap', () => {
    const scrap = makeScrap({ tl1: 2 })
    // Need 5 * 1 = 5, have 2
    expect(canAffordMinimumUpkeep(scrap, 1)).toBe(false)
  })

  test('exactly enough scrap', () => {
    const scrap = makeScrap({ tl1: 5 })
    // Need 5 * 1 = 5, have 5
    expect(canAffordMinimumUpkeep(scrap, 1)).toBe(true)
  })

  test('no scrap at all', () => {
    const scrap = makeScrap()
    expect(canAffordMinimumUpkeep(scrap, 1)).toBe(false)
  })

  test('high crawler TL requires more total value', () => {
    // Need 5 * 6 = 30 TL1-eq, have 4*6 = 24
    const scrap = makeScrap({ tl6: 4 })
    expect(canAffordMinimumUpkeep(scrap, 6)).toBe(false)
  })
})
