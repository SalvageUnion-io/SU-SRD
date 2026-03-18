import { describe, expect, it } from 'bun:test'
import {
  getHeatGenerated,
  applyHeat,
  canActivateAction,
  shouldTriggerHeatCheck,
  canPush,
  nextCondition,
  applySpDamage,
} from '../lib/combatUtils.js'

// -------------------------------------------------------------------------
// getHeatGenerated
// -------------------------------------------------------------------------

describe('getHeatGenerated', () => {
  it('returns numeric amount for entity with hot trait and amount', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
      traits: [{ type: 'hot', amount: 2 }],
    }
    expect(getHeatGenerated(entity)).toBe(2)
  })

  it('returns the correct amount when hot trait amount is a different number', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
      traits: [{ type: 'hot', amount: 5 }],
    }
    expect(getHeatGenerated(entity)).toBe(5)
  })

  it('returns variable for entity with hot (x) trait', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
      traits: [{ type: 'hot (x)' }],
    }
    expect(getHeatGenerated(entity)).toBe('variable')
  })

  it('returns 0 for entity with no hot trait', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
      traits: [{ type: 'burst', amount: 3 }],
    }
    expect(getHeatGenerated(entity)).toBe(0)
  })

  it('returns 0 for entity with no traits array', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
    }
    expect(getHeatGenerated(entity)).toBe(0)
  })

  it('returns 0 for entity with empty traits array', () => {
    const entity = {
      id: 'test-action',
      name: 'Test Action',
      traits: [],
    }
    expect(getHeatGenerated(entity)).toBe(0)
  })
})

// -------------------------------------------------------------------------
// applyHeat
// -------------------------------------------------------------------------

describe('applyHeat', () => {
  it('adds heat normally when under cap', () => {
    expect(applyHeat(3, 2, 10)).toBe(5)
  })

  it('clamps at cap when heat would exceed cap', () => {
    expect(applyHeat(8, 5, 10)).toBe(10)
  })

  it('does not change heat when heatGenerated is zero', () => {
    expect(applyHeat(4, 0, 10)).toBe(4)
  })

  it('stays at cap when already at cap', () => {
    expect(applyHeat(10, 2, 10)).toBe(10)
  })

  it('returns exact cap when result exactly equals cap', () => {
    expect(applyHeat(5, 5, 10)).toBe(10)
  })
})

// -------------------------------------------------------------------------
// canActivateAction
// -------------------------------------------------------------------------

describe('canActivateAction', () => {
  it('returns true when there is sufficient headroom', () => {
    expect(canActivateAction(3, 2, 10)).toBe(true)
  })

  it('returns false when action would exceed cap', () => {
    expect(canActivateAction(9, 2, 10)).toBe(false)
  })

  it('returns true when result exactly equals cap', () => {
    expect(canActivateAction(8, 2, 10)).toBe(true)
  })

  it('returns true for zero cost action', () => {
    expect(canActivateAction(10, 0, 10)).toBe(true)
  })

  it('returns false when already at cap with any cost', () => {
    expect(canActivateAction(10, 1, 10)).toBe(false)
  })
})

// -------------------------------------------------------------------------
// shouldTriggerHeatCheck
// -------------------------------------------------------------------------

describe('shouldTriggerHeatCheck', () => {
  it('returns false when heat gain stays below capacity', () => {
    // 3 + 2 = 5, cap = 10 — no trigger
    expect(shouldTriggerHeatCheck(3, 2, 10)).toBe(false)
  })

  it('returns false when heat gain of zero (no heat action)', () => {
    expect(shouldTriggerHeatCheck(5, 0, 10)).toBe(false)
  })

  it('returns true when heat gain exactly reaches capacity', () => {
    // 5 + 5 = 10, cap = 10 — trigger
    expect(shouldTriggerHeatCheck(5, 5, 10)).toBe(true)
  })

  it('returns true when heat gain exceeds capacity (clamped to cap)', () => {
    // 8 + 5 = 13 > 10, clamps to cap — trigger
    expect(shouldTriggerHeatCheck(8, 5, 10)).toBe(true)
  })

  it('returns true when already at capacity and any heat is gained', () => {
    // 10 + 2, cap = 10 — already at cap, trigger
    expect(shouldTriggerHeatCheck(10, 2, 10)).toBe(true)
  })

  it('returns false when heat gain below cap from low baseline', () => {
    // 0 + 3 = 3, cap = 10 — no trigger
    expect(shouldTriggerHeatCheck(0, 3, 10)).toBe(false)
  })
})

// -------------------------------------------------------------------------
// canPush
// -------------------------------------------------------------------------

describe('canPush', () => {
  it('returns true when currentHeat + 2 is within cap', () => {
    expect(canPush(5, 10)).toBe(true)
  })

  it('returns false when currentHeat + 2 would exceed cap', () => {
    expect(canPush(9, 10)).toBe(false)
  })

  it('returns true when currentHeat + 2 exactly equals cap', () => {
    expect(canPush(8, 10)).toBe(true)
  })

  it('returns false when already at cap', () => {
    expect(canPush(10, 10)).toBe(false)
  })
})

// -------------------------------------------------------------------------
// nextCondition
// -------------------------------------------------------------------------

describe('nextCondition', () => {
  it('transitions from intact to damaged', () => {
    expect(nextCondition('intact')).toBe('damaged')
  })

  it('transitions from damaged to destroyed', () => {
    expect(nextCondition('damaged')).toBe('destroyed')
  })

  it('stays at destroyed when already destroyed', () => {
    expect(nextCondition('destroyed')).toBe('destroyed')
  })
})

// -------------------------------------------------------------------------
// applySpDamage
// -------------------------------------------------------------------------

describe('applySpDamage', () => {
  it('reduces SP and calculates HP damage for normal damage', () => {
    expect(applySpDamage(10, 4)).toEqual({ newSp: 6, hpDamage: 2 })
  })

  it('clamps SP to 0 and still calculates HP damage when damage exceeds SP', () => {
    expect(applySpDamage(3, 5)).toEqual({ newSp: 0, hpDamage: 2 })
  })

  it('floors HP damage for odd damage amounts', () => {
    expect(applySpDamage(10, 3)).toEqual({ newSp: 7, hpDamage: 1 })
  })

  it('returns unchanged SP and zero HP damage for zero damage', () => {
    expect(applySpDamage(10, 0)).toEqual({ newSp: 10, hpDamage: 0 })
  })

  it('handles damage exactly equal to SP', () => {
    expect(applySpDamage(5, 5)).toEqual({ newSp: 0, hpDamage: 2 })
  })
})
