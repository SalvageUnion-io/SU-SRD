import { describe, test, expect } from 'bun:test'
import { computeShutdown, computeActivation, canActivate } from './shutdownUtils'
import type { MechRow } from '../types/common'
import type { PilotRow } from '../types/common'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMech(overrides: Partial<MechRow> = {}): MechRow {
  return {
    id: 'mech-1',
    active: true,
    current_heat: 5,
    current_ep: 3,
    max_ep: 10,
    current_sp: 8,
    max_sp: 8,
    heat_capacity: 10,
    cargo_capacity: 4,
    chassis_ref: 'iron-mongrel',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    image_path: null,
    notes: null,
    pattern_name: 'Test Mech',
    source_pattern_id: null,
    source_ref_pattern_id: null,
    user_id: 'user-1',
    ...overrides,
  } as MechRow
}

function makePilot(overrides: Partial<PilotRow> = {}): PilotRow {
  return {
    id: 'pilot-1',
    ap: 3,
    callsign: 'Gravel',
    class_ref: 'scavenger',
    mech_id: 'mech-1',
    active: true,
    user_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    appearance: null,
    background: null,
    background_used: null,
    keepsake: null,
    motto: null,
    injuries: null,
    ...overrides,
  } as unknown as PilotRow
}

// ---------------------------------------------------------------------------
// computeShutdown
// ---------------------------------------------------------------------------

describe('computeShutdown', () => {
  test('resets heat to 0', () => {
    const mech = makeMech({ current_heat: 7 })
    const result = computeShutdown(mech)
    expect(result.current_heat).toBe(0)
  })

  test('resets EP to max_ep', () => {
    const mech = makeMech({ current_ep: 2, max_ep: 10 })
    const result = computeShutdown(mech)
    expect(result.current_ep).toBe(10)
  })

  test('returns EP equal to max_ep when already at max', () => {
    const mech = makeMech({ current_ep: 10, max_ep: 10 })
    const result = computeShutdown(mech)
    expect(result.current_ep).toBe(10)
  })

  test('returns heat 0 even when already at 0', () => {
    const mech = makeMech({ current_heat: 0 })
    const result = computeShutdown(mech)
    expect(result.current_heat).toBe(0)
  })

  test('result only contains current_heat and current_ep fields', () => {
    const mech = makeMech({ current_heat: 5, current_ep: 2, max_ep: 8 })
    const result = computeShutdown(mech)
    expect(Object.keys(result).sort()).toEqual(['current_ep', 'current_heat'])
  })
})

// ---------------------------------------------------------------------------
// computeActivation
// ---------------------------------------------------------------------------

describe('computeActivation', () => {
  test('decrements AP by 1', () => {
    const pilot = makePilot({ ap: 3 })
    const result = computeActivation(pilot)
    expect(result.ap).toBe(2)
  })

  test('decrements AP from 1 to 0', () => {
    const pilot = makePilot({ ap: 1 })
    const result = computeActivation(pilot)
    expect(result.ap).toBe(0)
  })

  test('result only contains ap field', () => {
    const pilot = makePilot({ ap: 2 })
    const result = computeActivation(pilot)
    expect(Object.keys(result)).toEqual(['ap'])
  })
})

// ---------------------------------------------------------------------------
// canActivate
// ---------------------------------------------------------------------------

describe('canActivate', () => {
  test('returns true when mech is inactive and pilot has AP', () => {
    const mech = makeMech({ active: false })
    const pilot = makePilot({ ap: 1 })
    expect(canActivate(mech, pilot)).toBe(true)
  })

  test('returns false when mech is already active', () => {
    const mech = makeMech({ active: true })
    const pilot = makePilot({ ap: 3 })
    expect(canActivate(mech, pilot)).toBe(false)
  })

  test('returns false when AP is 0', () => {
    const mech = makeMech({ active: false })
    const pilot = makePilot({ ap: 0 })
    expect(canActivate(mech, pilot)).toBe(false)
  })

  test('returns false when mech is active AND AP is 0', () => {
    const mech = makeMech({ active: true })
    const pilot = makePilot({ ap: 0 })
    expect(canActivate(mech, pilot)).toBe(false)
  })

  test('returns true with exactly 1 AP and inactive mech', () => {
    const mech = makeMech({ active: false })
    const pilot = makePilot({ ap: 1 })
    expect(canActivate(mech, pilot)).toBe(true)
  })

  test('returns false when AP is negative (degenerate input)', () => {
    const mech = makeMech({ active: false })
    const pilot = makePilot({ ap: -1 })
    expect(canActivate(mech, pilot)).toBe(false)
  })
})
