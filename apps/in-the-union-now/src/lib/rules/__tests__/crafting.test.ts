/**
 * Unit tests for crafting.ts — the Crafting Bay flow (design-review R-7;
 * Core Book p.222 + p.244).
 *
 * Pure arithmetic on hand-crafted pools/items — no reference data needed.
 */
import { describe, expect, it } from 'bun:test'

import type { ScrapPool } from '../../schemas/crawler'
import { craftQuote, craftableAtTl, craftedLot } from '../crafting'

const RED_LASER = { name: 'Red Laser', techLevel: 1, salvageValue: 3 }
const HEAVY_LASER = { name: 'Heavy Laser', techLevel: 2, salvageValue: 4 }

describe('craftableAtTl (p.222 — crawler TL or lower)', () => {
  it('allows items at or below the crawler tech level', () => {
    expect(craftableAtTl(1, 2)).toBe(true)
    expect(craftableAtTl(2, 2)).toBe(true)
  })

  it('refuses items above the crawler tech level', () => {
    expect(craftableAtTl(3, 2)).toBe(false)
  })

  it('refuses non-scrap tech levels', () => {
    expect(craftableAtTl(0, 6)).toBe(false)
    expect(craftableAtTl(7, 6)).toBe(false)
    expect(craftableAtTl(1.5, 6)).toBe(false)
  })
})

describe('craftQuote (p.244 — cost = Salvage Value, item TL or higher)', () => {
  it('costs the Salvage Value and draws from the item-TL bucket first', () => {
    const pool: ScrapPool = { tl1: 5, tl2: 2 }
    const quote = craftQuote(RED_LASER, pool, 2)
    expect(quote.cost).toBe(3)
    expect(quote.eligible).toBe(true)
    expect(quote.affordable).toBe(true)
    expect(quote.shortfall).toBe(0)
    expect(quote.draws).toEqual([{ tl: 1, count: 3 }])
    expect(quote.pool).toEqual({ tl1: 2, tl2: 2 })
  })

  it('spills into higher buckets when the item-TL bucket is short', () => {
    const pool: ScrapPool = { tl1: 1, tl3: 5 }
    const quote = craftQuote(RED_LASER, pool, 3)
    expect(quote.affordable).toBe(true)
    expect(quote.draws).toEqual([
      { tl: 1, count: 1 },
      { tl: 3, count: 2 },
    ])
    expect(quote.pool).toEqual({ tl1: 0, tl3: 3 })
  })

  it('never draws from buckets below the item TL', () => {
    const pool: ScrapPool = { tl1: 10 }
    const quote = craftQuote(HEAVY_LASER, pool, 2)
    expect(quote.affordable).toBe(false)
    expect(quote.shortfall).toBe(4)
    expect(quote.draws).toEqual([])
    expect(quote.pool).toEqual(pool)
  })

  it('reports the shortfall when the pool cannot cover the cost', () => {
    const pool: ScrapPool = { tl2: 1 }
    const quote = craftQuote(HEAVY_LASER, pool, 2)
    expect(quote.affordable).toBe(false)
    expect(quote.shortfall).toBe(3)
    expect(quote.pool).toEqual(pool)
  })

  it('marks items above the crawler TL ineligible (p.222)', () => {
    const pool: ScrapPool = { tl2: 10 }
    const quote = craftQuote(HEAVY_LASER, pool, 1)
    expect(quote.eligible).toBe(false)
    // Affordability is still honestly computed — the UI gates on eligible.
    expect(quote.affordable).toBe(true)
  })
})

describe('craftedLot', () => {
  it('mints an Intact unit lot with slots = Salvage Value and the item TL', () => {
    const lot = craftedLot(HEAVY_LASER)
    expect(lot).toMatchObject({
      kind: 'unit',
      name: 'Heavy Laser',
      cat: 'SYSTEM',
      units: 4,
      tl: 2,
    })
    // Crafted items are new — never "(Damaged)".
    expect(lot.name).not.toContain('Damaged')
  })

  it('floors the slot cost at 1', () => {
    const lot = craftedLot({ name: 'Scrap Widget', techLevel: 1, salvageValue: 0 })
    expect(lot.units).toBe(1)
  })
})
