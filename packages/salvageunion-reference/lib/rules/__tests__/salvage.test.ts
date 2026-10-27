/**
 * Area Salvage rule tests.
 *
 * Core Book pp. 244–248. Each test passes its d20, so none is random.
 */

import { describe, expect, test } from 'bun:test'
import {
  AREA_SALVAGE_LABEL,
  areaSalvageBand,
  areaSalvageResult,
  MECH_SALVAGE_LABEL,
  mechSalvageAllows,
  mechSalvageBand,
  mechSalvageResult,
  mechSalvageScrap,
} from '../salvage'

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
// areaSalvageResult — scrap quantities + jackpot choice
// ---------------------------------------------------------------------------

describe('areaSalvageResult', () => {
  test('scrap bands deposit 1/2/3 scrap at the area TL', () => {
    const one = areaSalvageResult({ areaTl: 3, d20: 4 })
    expect(one.scrapQty).toBe(1)
    expect(one.areaTl).toBe(3)
    expect(one.requiresPlayerChoice).toBe(false)

    const two = areaSalvageResult({ areaTl: 3, d20: 8 })
    expect(two.scrapQty).toBe(2)

    const three = areaSalvageResult({ areaTl: 3, d20: 15 })
    expect(three.scrapQty).toBe(3)
  })

  test('a 1 finds nothing', () => {
    const result = areaSalvageResult({ areaTl: 2, d20: 1 })
    expect(result.band).toBe('nothing')
    expect(result.scrapQty).toBe(0)
    expect(result.requiresPlayerChoice).toBe(false)
    expect(result.label).toBe(AREA_SALVAGE_LABEL.nothing)
  })

  test('a 20 grants no scrap and requires a player choice', () => {
    const result = areaSalvageResult({ areaTl: 4, d20: 20 })
    expect(result.band).toBe('jackpot')
    expect(result.scrapQty).toBe(0)
    expect(result.requiresPlayerChoice).toBe(true)
    expect(result.itemCount).toBe(1)
    expect(result.label).toBe('Jackpot!')
  })
})

describe('Expert Salvager (p.40)', () => {
  test('one more Scrap on every band, so a 1 still finds one', () => {
    expect(areaSalvageResult({ areaTl: 2, d20: 1, expert: true }).scrapQty).toBe(1)
    expect(areaSalvageResult({ areaTl: 2, d20: 4, expert: true }).scrapQty).toBe(2)
    expect(areaSalvageResult({ areaTl: 2, d20: 15, expert: true }).scrapQty).toBe(4)
  })

  test('a 20 finds a second item, and the extra Scrap', () => {
    const result = areaSalvageResult({ areaTl: 3, d20: 20, expert: true })
    expect(result.itemCount).toBe(2)
    expect(result.scrapQty).toBe(1)
  })
})

describe('Mech Salvage (p.248)', () => {
  test('bands follow the table', () => {
    expect(mechSalvageBand(1)).toBe('ashes')
    expect(mechSalvageBand(2)).toBe('nuts')
    expect(mechSalvageBand(5)).toBe('nuts')
    expect(mechSalvageBand(6)).toBe('bits')
    expect(mechSalvageBand(10)).toBe('bits')
    expect(mechSalvageBand(11)).toBe('meat')
    expect(mechSalvageBand(19)).toBe('meat')
    expect(mechSalvageBand(20)).toBe('lions')
    expect(mechSalvageResult(20)).toEqual({ roll: 20, band: 'lions', label: 'Lions Share' })
    expect(MECH_SALVAGE_LABEL.ashes).toBe('Ashes and Dust')
  })

  test('each band allows what it says, and never more', () => {
    const none = { chassis: false, systems: 0, modules: 0 }
    expect(mechSalvageAllows('ashes', none)).toBe(true)
    expect(mechSalvageAllows('nuts', { ...none, systems: 1 })).toBe(false)
    expect(mechSalvageAllows('bits', { ...none, modules: 1 })).toBe(true)
    expect(mechSalvageAllows('bits', { ...none, chassis: true })).toBe(false)
    expect(mechSalvageAllows('bits', { ...none, systems: 1, modules: 1 })).toBe(false)
    expect(mechSalvageAllows('meat', { ...none, chassis: true })).toBe(true)
    expect(mechSalvageAllows('meat', { chassis: true, systems: 1, modules: 0 })).toBe(false)
    expect(mechSalvageAllows('lions', { chassis: true, systems: 1, modules: 1 })).toBe(true)
    expect(mechSalvageAllows('lions', { chassis: true, systems: 2, modules: 0 })).toBe(false)
  })

  test('the 2–5 band pays half the Chassis Salvage Value, at least 1', () => {
    expect(mechSalvageScrap(7)).toBe(3)
    expect(mechSalvageScrap(8)).toBe(4)
    expect(mechSalvageScrap(1)).toBe(1)
    expect(mechSalvageScrap(0)).toBe(1)
  })
})
