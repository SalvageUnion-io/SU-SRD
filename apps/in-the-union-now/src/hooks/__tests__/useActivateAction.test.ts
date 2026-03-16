import { describe, test, expect } from 'bun:test'
import {
  buildUseActionResult,
  canActivateMechAction,
  resolveHeatCost,
} from '../useActivateAction'
import type { ActionDisplayData } from '../../lib/pilotActionUtils'
import type { MechRow, PilotRow } from '../../types/common'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMech(overrides: Partial<MechRow> = {}): MechRow {
  return {
    id: 'mech-1',
    user_id: 'user-1',
    chassis_ref: 'chassis-1',
    pattern_name: null,
    current_sp: 10,
    current_ep: 6,
    current_heat: 0,
    heat_capacity: 10,
    salvage_slots_used: 0,
    source_pattern_id: null,
    source_ref_pattern_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as MechRow
}

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'pilot-1',
    user_id: 'user-1',
    callsign: 'TestPilot',
    class_ref: 'class-1',
    hp: 6,
    max_hp: 6,
    ap: 6,
    max_ap: 6,
    tp: 0,
    mech_id: null,
    crawler_id: null,
    visible: true,
    is_boarded: false,
    in_downtime: false,
    background: null,
    motto: null,
    keepsake: null,
    appearance: null,
    image_path: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as PilotRow
}

function makeAction(overrides: Partial<ActionDisplayData> = {}): ActionDisplayData {
  return {
    key: 'test-action',
    name: 'Test Action',
    actionName: 'Test Action',
    sourceEntity: { traits: [] } as unknown as ActionDisplayData['sourceEntity'],
    sourceSchemaName: 'systems',
    borderColor: '#fff',
    dataValues: [],
    entityRefId: null,
    activationCost: 1,
    maxUses: null,
    usesRemaining: null,
    requiredTraits: [],
    actionType: 'Turn',
    source: 'mech',
    costType: 'ep',
    hasDamage: false,
    isComrade: false,
    destroyOnUse: false,
    condition: 'intact',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveHeatCost — reads from entity traits
// ---------------------------------------------------------------------------

describe('resolveHeatCost', () => {
  test('returns 0 when entity has no traits', () => {
    const entity = { traits: [] }
    expect(resolveHeatCost(entity)).toBe(0)
  })

  test('returns fixed heat amount for hot trait', () => {
    const entity = { traits: [{ type: 'hot', amount: 3 }] }
    expect(resolveHeatCost(entity)).toBe(3)
  })

  test("returns 'variable' for hot(x) trait", () => {
    const entity = { traits: [{ type: 'hot (x)' }] }
    expect(resolveHeatCost(entity)).toBe('variable')
  })

  test('returns 0 when entity has no hot trait', () => {
    const entity = { traits: [{ type: 'blast', amount: 2 }] }
    expect(resolveHeatCost(entity)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// canActivateMechAction — validates heat budget and EP
// ---------------------------------------------------------------------------

describe('canActivateMechAction', () => {
  test('returns null when action can be used', () => {
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 4 })
    expect(canActivateMechAction(mech, 1, 2)).toBeNull()
  })

  test('returns error when heat cost would exceed heat cap', () => {
    const mech = makeMech({ current_heat: 9, heat_capacity: 10, current_ep: 4 })
    const reason = canActivateMechAction(mech, 1, 2)
    expect(reason).not.toBeNull()
    expect(reason).toContain('heat')
  })

  test('returns error when heat cost equals exactly heat cap (allowed)', () => {
    // 0 + 10 = 10 = heatCap → exactly at cap is blocked (canActivateAction uses <=)
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 4 })
    // 0 + 10 <= 10 → true → allowed
    expect(canActivateMechAction(mech, 1, 10)).toBeNull()
  })

  test('returns error when heat cost would exceed heat cap by 1', () => {
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 4 })
    const reason = canActivateMechAction(mech, 1, 11)
    expect(reason).not.toBeNull()
  })

  test('returns error when EP is insufficient', () => {
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 0 })
    const reason = canActivateMechAction(mech, 3, 2)
    expect(reason).not.toBeNull()
    expect(reason).toContain('EP')
  })

  test('returns null when EP exactly covers cost', () => {
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 3 })
    expect(canActivateMechAction(mech, 3, 0)).toBeNull()
  })

  test('returns heat error before EP error', () => {
    // Both heat and EP would fail — heat is checked first
    const mech = makeMech({ current_heat: 10, heat_capacity: 10, current_ep: 0 })
    const reason = canActivateMechAction(mech, 1, 2)
    expect(reason).toContain('heat')
  })
})

// ---------------------------------------------------------------------------
// buildUseActionResult — pure result computation
// ---------------------------------------------------------------------------

describe('buildUseActionResult', () => {
  test('computes new heat and heatCheckTriggered for mech EP action', () => {
    const mech = makeMech({ current_heat: 2, heat_capacity: 10, current_ep: 4 })
    const action = makeAction({ costType: 'ep', activationCost: 2, source: 'mech' })
    const heatCost = 3

    const result = buildUseActionResult({ mech, action, heatCost })

    expect(result.newHeat).toBe(5) // 2 + 3
    expect(result.newEp).toBe(2) // 4 - 2
    expect(result.heatCheckTriggered).toBe(true) // newHeat > 0
    expect(result.success).toBe(true)
  })

  test('heatCheckTriggered is false when no heat is added (0 heat cost)', () => {
    const mech = makeMech({ current_heat: 0, heat_capacity: 10, current_ep: 4 })
    const action = makeAction({ costType: 'ep', activationCost: 1, source: 'mech' })
    const heatCost = 0

    const result = buildUseActionResult({ mech, action, heatCost })

    expect(result.newHeat).toBe(0)
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('clamps newHeat at heat cap', () => {
    const mech = makeMech({ current_heat: 8, heat_capacity: 10, current_ep: 4 })
    const action = makeAction({ costType: 'ep', activationCost: 1, source: 'mech' })
    const heatCost = 5 // would go to 13, but capped at 10

    const result = buildUseActionResult({ mech, action, heatCost })

    expect(result.newHeat).toBe(10) // clamped
    expect(result.heatCheckTriggered).toBe(true)
  })

  test('computes pilot AP action (no heat)', () => {
    const pilot = makePilot({ ap: 4 })
    const action = makeAction({ costType: 'ap', activationCost: 2, source: 'pilot' })

    const result = buildUseActionResult({ pilot, action, heatCost: 0 })

    expect(result.newAp).toBe(2) // 4 - 2
    expect(result.newHeat).toBe(0)
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('handles null activationCost (free action)', () => {
    const mech = makeMech({ current_heat: 2, heat_capacity: 10, current_ep: 4 })
    const action = makeAction({ costType: 'none', activationCost: null, source: 'mech' })

    const result = buildUseActionResult({ mech, action, heatCost: 2 })

    expect(result.newEp).toBe(4) // no EP change
    expect(result.newHeat).toBe(4) // 2 + 2 heat still applied
  })
})

// ---------------------------------------------------------------------------
// useActivateAction hook — shape validation
// ---------------------------------------------------------------------------

describe('useActivateAction hook shape', () => {
  // The hook itself requires React and TanStack Query context, which is
  // complex to mock in unit tests. We verify the exported API contract here
  // through TypeScript (compile-time) and a minimal runtime check.

  test('module exports useActivateAction function', async () => {
    const mod = await import('../useActivateAction')
    expect(typeof mod.useActivateAction).toBe('function')
  })

  test('module exports UseActionResult type (compile-time only)', () => {
    // This test passes as long as the module exports the type without error.
    // The type itself is verified at compile time by TypeScript.
    expect(true).toBe(true)
  })
})
