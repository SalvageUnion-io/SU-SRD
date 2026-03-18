import { describe, test, expect } from 'bun:test'
import { getHeatLevel, getHeatColorClass, getUseButtonLabel } from './heatUtils'
import { buildUseActionResult } from '../hooks/useActivateAction'
import type { MechRow } from '../types/common'

// ---------------------------------------------------------------------------
// buildUseActionResult — heatCheckTriggered gate (rules p.234)
// ---------------------------------------------------------------------------

function makeMech(current_heat: number, heat_capacity: number): MechRow {
  return {
    id: 'mech-1',
    current_heat,
    heat_capacity,
    current_ep: 10,
    current_sp: 10,
    max_sp: 10,
    current_hp: 10,
    max_hp: 10,
    pattern_name: 'Test',
    pilot_id: 'pilot-1',
    crawler_id: 'crawler-1',
    is_boarded: true,
    max_ep: 10,
    created_at: null,
    updated_at: null,
  } as unknown as MechRow
}

const freeAction = {
  costType: 'none' as const,
  activationCost: null,
  source: 'mech' as const,
  isComrade: false,
  name: 'Test Action',
  actionName: 'test-action',
  maxUses: null,
  entityRefId: null,
  sourceEntity: {},
  borderColor: '',
} as import('../lib/pilotActionUtils').ActionDisplayData

describe('buildUseActionResult — heatCheckTriggered', () => {
  test('does NOT trigger heat check when heat gain stays below capacity', () => {
    const mech = makeMech(3, 10)
    const result = buildUseActionResult({ mech, pilot: undefined, action: freeAction, heatCost: 2 })
    // 3 + 2 = 5, cap = 10 — no trigger
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('does NOT trigger heat check when heatCost is zero', () => {
    const mech = makeMech(5, 10)
    const result = buildUseActionResult({ mech, pilot: undefined, action: freeAction, heatCost: 0 })
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('DOES trigger heat check when heat gain reaches capacity exactly', () => {
    const mech = makeMech(5, 10)
    const result = buildUseActionResult({ mech, pilot: undefined, action: freeAction, heatCost: 5 })
    // 5 + 5 = 10, cap = 10 — trigger
    expect(result.heatCheckTriggered).toBe(true)
  })

  test('DOES trigger heat check when heat gain exceeds capacity', () => {
    const mech = makeMech(8, 10)
    const result = buildUseActionResult({ mech, pilot: undefined, action: freeAction, heatCost: 5 })
    // 8 + 5 = 13 > 10, clamps — trigger
    expect(result.heatCheckTriggered).toBe(true)
  })

  test('DOES trigger heat check when already at capacity and heat is gained', () => {
    const mech = makeMech(10, 10)
    const result = buildUseActionResult({ mech, pilot: undefined, action: freeAction, heatCost: 2 })
    expect(result.heatCheckTriggered).toBe(true)
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
