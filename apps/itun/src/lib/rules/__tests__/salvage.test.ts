/**
 * Area Salvage / Mech Salvage rule tests (design-review R-3).
 *
 * Core Book pp. 244–248. The d20 is INJECTABLE via the shared `Roll` seam, so
 * every test is deterministic — no real randomness.
 */

import { describe, expect, test } from 'bun:test'

import type { Roll } from '../heatCheck'
import {
  AREA_SALVAGE_LABEL,
  EMPTY_CLAIM,
  MECH_SALVAGE_LABEL,
  areaJackpotClaim,
  areaSalvageBand,
  claimAllows,
  claimExhausted,
  damagedSalvageLot,
  halfSalvageScrap,
  mechSalvageBand,
  performAreaSalvage,
  performMechSalvage,
  takeFromClaim,
} from '../salvage'
import type { SalvageClaim, WreckChassis } from '../salvage'

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

// ---------------------------------------------------------------------------
// Claims — the ADR-007 player-choice walk-down
// ---------------------------------------------------------------------------

describe('claims', () => {
  test('areaJackpotClaim allows one of chassis/system/module', () => {
    const claim = areaJackpotClaim()
    expect(claimAllows(claim, 'chassis')).toBe(true)
    expect(claimAllows(claim, 'system')).toBe(true)
    expect(claimAllows(claim, 'module')).toBe(true)
    expect(claimExhausted(claim)).toBe(false)
  })

  test('exclusive claims zero out on ANY take (the OR bands)', () => {
    const claim = areaJackpotClaim()
    expect(claimExhausted(takeFromClaim(claim, 'chassis'))).toBe(true)
    expect(claimExhausted(takeFromClaim(claim, 'system'))).toBe(true)
    expect(claimExhausted(takeFromClaim(claim, 'module'))).toBe(true)
  })

  test('the 20-band claim requires one System AND one Module', () => {
    const claim: SalvageClaim = { ...EMPTY_CLAIM, systemPicks: 1, modulePicks: 1 }
    const afterSystem = takeFromClaim(claim, 'system')
    expect(afterSystem.systemPicks).toBe(0)
    expect(afterSystem.modulePicks).toBe(1)
    expect(claimAllows(afterSystem, 'system')).toBe(false)
    expect(claimAllows(afterSystem, 'module')).toBe(true)
    expect(claimExhausted(afterSystem)).toBe(false)
    expect(claimExhausted(takeFromClaim(afterSystem, 'module'))).toBe(true)
  })

  test('kind-specific picks decrement before flexible picks', () => {
    const claim: SalvageClaim = { ...EMPTY_CLAIM, systemPicks: 1, eitherPicks: 1 }
    const after = takeFromClaim(claim, 'system')
    expect(after.systemPicks).toBe(0)
    expect(after.eitherPicks).toBe(1)
  })

  test('an invalid take leaves the claim unchanged', () => {
    const claim: SalvageClaim = { ...EMPTY_CLAIM, eitherPicks: 1 }
    expect(takeFromClaim(claim, 'chassis')).toEqual(claim)
  })
})

// ---------------------------------------------------------------------------
// mechSalvageBand + halfSalvageScrap
// ---------------------------------------------------------------------------

describe('mechSalvageBand', () => {
  test('band boundaries match the Mech Salvage table', () => {
    expect(mechSalvageBand(1)).toBe('unsalvageable')
    expect(mechSalvageBand(2)).toBe('scrap')
    expect(mechSalvageBand(5)).toBe('scrap')
    expect(mechSalvageBand(6)).toBe('system-or-module')
    expect(mechSalvageBand(10)).toBe('system-or-module')
    expect(mechSalvageBand(11)).toBe('chassis-or-item')
    expect(mechSalvageBand(19)).toBe('chassis-or-item')
    expect(mechSalvageBand(20)).toBe('full-strip')
  })
})

describe('halfSalvageScrap', () => {
  test('halves the Salvage Value, rounding down', () => {
    expect(halfSalvageScrap(7)).toBe(3)
    expect(halfSalvageScrap(10)).toBe(5)
  })

  test('floors at 1 (to a minimum of 1, per the table)', () => {
    expect(halfSalvageScrap(1)).toBe(1)
    expect(halfSalvageScrap(0)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// performMechSalvage — per-band effects
// ---------------------------------------------------------------------------

const WRECK: WreckChassis = { name: 'Mule', techLevel: 1, salvageValue: 7 }

describe('performMechSalvage', () => {
  test('1 → unsalvageable: nothing granted, no choice', () => {
    const result = performMechSalvage({ chassis: WRECK, roll: fixedRoll(1) })
    expect(result.band).toBe('unsalvageable')
    expect(result.scrapQty).toBe(0)
    expect(result.chassisGranted).toBe(false)
    expect(result.requiresPlayerChoice).toBe(false)
    expect(result.label).toBe(MECH_SALVAGE_LABEL.unsalvageable)
  })

  test('2-5 → half-SV scrap at the chassis TL, auto-deposit', () => {
    const result = performMechSalvage({ chassis: WRECK, roll: fixedRoll(3) })
    expect(result.band).toBe('scrap')
    expect(result.scrapQty).toBe(3) // floor(7/2), min 1
    expect(result.scrapTl).toBe(1)
    expect(result.chassisGranted).toBe(false)
    expect(result.requiresPlayerChoice).toBe(false)
  })

  test('6-10 → claim one System OR Module', () => {
    const result = performMechSalvage({ chassis: WRECK, roll: fixedRoll(8) })
    expect(result.band).toBe('system-or-module')
    expect(result.claim.eitherPicks).toBe(1)
    expect(claimAllows(result.claim, 'chassis')).toBe(false)
    expect(result.requiresPlayerChoice).toBe(true)
  })

  test('11-19 → claim the Chassis OR a System OR a Module (exclusive)', () => {
    const result = performMechSalvage({ chassis: WRECK, roll: fixedRoll(15) })
    expect(result.band).toBe('chassis-or-item')
    expect(result.claim.chassis).toBe(true)
    expect(result.claim.chassisExclusive).toBe(true)
    expect(result.claim.eitherPicks).toBe(1)
    expect(result.chassisGranted).toBe(false)
  })

  test('20 → chassis granted outright plus one System and one Module', () => {
    const result = performMechSalvage({ chassis: WRECK, roll: fixedRoll(20) })
    expect(result.band).toBe('full-strip')
    expect(result.chassisGranted).toBe(true)
    expect(result.claim.systemPicks).toBe(1)
    expect(result.claim.modulePicks).toBe(1)
    expect(result.claim.chassis).toBe(false)
    expect(result.requiresPlayerChoice).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// damagedSalvageLot — salvage → cargo lot
// ---------------------------------------------------------------------------

describe('damagedSalvageLot', () => {
  test('builds a Damaged unit lot costing Salvage Value slots (p.246)', () => {
    const lot = damagedSalvageLot({ name: 'Red Laser', salvageValue: 3, techLevel: 2 })
    expect(lot.kind).toBe('unit')
    expect(lot.name).toBe('Red Laser (Damaged)')
    expect(lot.cat).toBe('SYSTEM')
    expect(lot.units).toBe(3)
    expect(lot.tl).toBe(2)
  })

  test('floors the slot cost at 1 and omits out-of-range TLs', () => {
    const lot = damagedSalvageLot({ name: 'Widget', salvageValue: 0 })
    expect(lot.units).toBe(1)
    expect(lot.tl).toBeUndefined()
  })
})
