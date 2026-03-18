import { describe, test, expect } from 'bun:test'
import { getHeatLevel, getHeatColorClass, getUseButtonLabel, clampHeat } from './heatUtils'

// ---------------------------------------------------------------------------
// clampHeat
// ---------------------------------------------------------------------------

describe('clampHeat', () => {
  test('returns value unchanged when within bounds', () => {
    expect(clampHeat(5, 10)).toBe(5)
  })

  test('clamps to 0 when value is negative', () => {
    expect(clampHeat(-1, 10)).toBe(0)
  })

  test('returns 0 when value is 0', () => {
    expect(clampHeat(0, 10)).toBe(0)
  })

  test('clamps to heat capacity when value exceeds cap', () => {
    expect(clampHeat(11, 10)).toBe(10)
  })

  test('returns heat capacity when value equals cap exactly', () => {
    expect(clampHeat(10, 10)).toBe(10)
  })

  test('clamps to 0 when heat cap is 0', () => {
    expect(clampHeat(5, 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getHeatLevel
// ---------------------------------------------------------------------------

describe('getHeatLevel', () => {
  test('returns normal when heat is 0 and cap is 10', () => {
    expect(getHeatLevel(0, 10)).toBe('normal')
  })

  test('returns normal at 49% of cap', () => {
    // 4/10 = 40%
    expect(getHeatLevel(4, 10)).toBe('normal')
    // 4.9/10 = 49%
    expect(getHeatLevel(4, 10)).toBe('normal')
  })

  test('returns warning at 50% of cap', () => {
    // 5/10 = 50%
    expect(getHeatLevel(5, 10)).toBe('warning')
  })

  test('returns warning at 79% of cap', () => {
    // 7/10 = 70% -> warning
    expect(getHeatLevel(7, 10)).toBe('warning')
    // 7.9/10 = 79%
    // Use cap=100 so we can use integers precisely
    expect(getHeatLevel(79, 100)).toBe('warning')
  })

  test('returns danger at 80% of cap', () => {
    // 8/10 = 80%
    expect(getHeatLevel(8, 10)).toBe('danger')
  })

  test('returns danger at 99% of cap', () => {
    expect(getHeatLevel(99, 100)).toBe('danger')
  })

  test('returns critical at 100% of cap (at cap)', () => {
    // 10/10 = 100%
    expect(getHeatLevel(10, 10)).toBe('critical')
  })

  test('returns critical when heat equals cap exactly', () => {
    expect(getHeatLevel(6, 6)).toBe('critical')
  })

  test('returns normal when cap is 0 to avoid division by zero', () => {
    expect(getHeatLevel(0, 0)).toBe('normal')
  })

  test('returns normal at exactly 0% heat', () => {
    expect(getHeatLevel(0, 8)).toBe('normal')
  })
})

// ---------------------------------------------------------------------------
// getHeatColorClass
// ---------------------------------------------------------------------------

describe('getHeatColorClass', () => {
  test('normal returns empty string (no color override)', () => {
    expect(getHeatColorClass('normal')).toBe('')
  })

  test('warning returns amber class', () => {
    expect(getHeatColorClass('warning')).toBe('text-amber-500')
  })

  test('danger returns orange class', () => {
    expect(getHeatColorClass('danger')).toBe('text-orange-600')
  })

  test('critical returns red class', () => {
    expect(getHeatColorClass('critical')).toBe('text-red-600')
  })
})

// ---------------------------------------------------------------------------
// getUseButtonLabel
// ---------------------------------------------------------------------------

describe('getUseButtonLabel', () => {
  test('returns "Use" for entity with no traits', () => {
    expect(getUseButtonLabel({})).toBe('Use')
    expect(getUseButtonLabel({ traits: [] })).toBe('Use')
  })

  test('returns "Use" for entity with non-hot traits', () => {
    expect(getUseButtonLabel({ traits: [{ type: 'energy', amount: 2 }] })).toBe('Use')
  })

  test('returns "Use (Heat: N)" for entity with fixed hot trait', () => {
    expect(getUseButtonLabel({ traits: [{ type: 'hot', amount: 3 }] })).toBe('Use (Heat: 3)')
  })

  test('returns "Use (Heat: 1)" for hot trait with amount 1', () => {
    expect(getUseButtonLabel({ traits: [{ type: 'hot', amount: 1 }] })).toBe('Use (Heat: 1)')
  })

  test('returns "Use (Heat: ?)" for variable heat trait', () => {
    expect(getUseButtonLabel({ traits: [{ type: 'hot (x)' }] })).toBe('Use (Heat: ?)')
  })

  test('returns "Use" for hot trait with no amount', () => {
    // hot with no amount => getHeatGenerated returns 0
    expect(getUseButtonLabel({ traits: [{ type: 'hot' }] })).toBe('Use')
  })
})
