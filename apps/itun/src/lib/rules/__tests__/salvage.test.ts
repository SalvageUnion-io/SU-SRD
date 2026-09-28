/**
 * Area Salvage rule tests (design-review R-3).
 *
 * Core Book pp. 244–248. The d20 is INJECTABLE via the shared `Roll` seam, so
 * every test is deterministic — no real randomness.
 */

import { describe, expect, test } from 'bun:test'
import type { Roll } from '../heatCheck'
import { AREA_SALVAGE_LABEL, areaSalvageBand, performAreaSalvage } from '../salvage'

/** Returns a Roll that always yields `value`, ignoring `sides`. */
function fixedRoll(value: number): Roll {
  return () => value
}

// ---------------------------------------------------------------------------
// areaSalvageBand — band boundaries (Area Salvage table, p.248)
// ---------------------------------------------------------------------------

describe('areaSalvageBand', () => {
  test('1 → nothing', () => {
    expect(areaSalvageBand(1)).toBe('nothing')
  })

  test('2-5 → scrap-1', () => {
    expect(areaSalvageBand(2)).toBe('scrap-1')
    expect(areaSalvageBand(5)).toBe('scrap-1')
  })

  test('6-10 → scrap-2', () => {
    expect(areaSalvageBand(6)).toBe('scrap-2')
    expect(areaSalvageBand(10)).toBe('scrap-2')
  })

  test('11-19 → scrap-3', () => {
    expect(areaSalvageBand(11)).toBe('scrap-3')
    expect(areaSalvageBand(19)).toBe('scrap-3')
  })

  test('20 → jackpot', () => {
    expect(areaSalvageBand(20)).toBe('jackpot')
  })
})

// ---------------------------------------------------------------------------
// performAreaSalvage — scrap quantities + jackpot choice
// ---------------------------------------------------------------------------

describe('performAreaSalvage', () => {
  test('scrap bands deposit 1/2/3 scrap at the area TL', () => {
    const one = performAreaSalvage({ areaTl: 3, roll: fixedRoll(4) })
    expect(one.scrapQty).toBe(1)
    expect(one.areaTl).toBe(3)
    expect(one.requiresPlayerChoice).toBe(false)

    const two = performAreaSalvage({ areaTl: 3, roll: fixedRoll(8) })
    expect(two.scrapQty).toBe(2)

    const three = performAreaSalvage({ areaTl: 3, roll: fixedRoll(15) })
    expect(three.scrapQty).toBe(3)
  })

  test('a 1 finds nothing', () => {
    const result = performAreaSalvage({ areaTl: 2, roll: fixedRoll(1) })
    expect(result.band).toBe('nothing')
    expect(result.scrapQty).toBe(0)
    expect(result.requiresPlayerChoice).toBe(false)
    expect(result.label).toBe(AREA_SALVAGE_LABEL.nothing)
  })

  test('a 20 grants no scrap and requires a player choice', () => {
    const result = performAreaSalvage({ areaTl: 4, roll: fixedRoll(20) })
    expect(result.band).toBe('jackpot')
    expect(result.scrapQty).toBe(0)
    expect(result.requiresPlayerChoice).toBe(true)
    expect(result.label).toBe('Jackpot!')
  })
})
