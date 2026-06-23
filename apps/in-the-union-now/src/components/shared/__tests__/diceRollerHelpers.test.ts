/**
 * Unit tests for diceRollerHelpers — pure logic, dep-injection only.
 *
 * Mirrors components/pilot/__tests__/rollTableHelpers.test.ts: avoids
 * `mock.module()` (which leaks globally across Bun test files) by passing a
 * stubbed DiceRollerDeps directly per test.
 */

import { describe, expect, test } from 'bun:test'
import { rollCoreMechanic } from '../diceRollerHelpers'
import type { DiceRollerDeps } from '../diceRollerHelpers'

type StubTable = {
  id: string
  name: string
  schemaName: 'roll-tables'
  table: Record<string, { value: string; label?: string }>
}

/** Core Mechanic bands per Core Rulebook p.232. */
const CORE_MECHANIC_TABLE: StubTable = {
  id: 'rt-core',
  name: 'Core Mechanic',
  schemaName: 'roll-tables',
  table: {
    '1': { label: 'Cascade Failure', value: 'Something has gone terribly wrong.' },
    '2-5': { label: 'Failure', value: 'You have failed.' },
    '6-10': { label: 'Tough Choice', value: 'You succeed, but at a cost.' },
    '11-19': { label: 'Success', value: 'You have achieved your goal.' },
    '20': { label: 'Nailed it', value: 'An outstanding success.' },
  },
}

function makeDeps(roll: number, table: StubTable = CORE_MECHANIC_TABLE): DiceRollerDeps {
  return {
    findTable: () => table as never,
    rollD20: () => roll,
  }
}

describe('rollCoreMechanic', () => {
  test('returns null when the Core Mechanic table is not found', () => {
    const noTableDeps: DiceRollerDeps = { findTable: () => undefined, rollD20: () => 10 }
    expect(rollCoreMechanic(0, noTableDeps)).toBeNull()
  })

  test('maps a plain d20 of 20 to Nailed it', () => {
    const result = rollCoreMechanic(0, makeDeps(20))
    expect(result).toEqual({
      roll: 20,
      modifier: 0,
      total: 20,
      label: 'Nailed it',
      value: 'An outstanding success.',
    })
  })

  test('maps a mid-range roll to Success', () => {
    expect(rollCoreMechanic(0, makeDeps(15))?.label).toBe('Success')
  })

  test('maps a roll of 1 to Cascade Failure', () => {
    expect(rollCoreMechanic(0, makeDeps(1))?.label).toBe('Cascade Failure')
  })

  test('adds a positive modifier before resolving the band', () => {
    // roll 4 + modifier 4 = 8 → Tough Choice band
    const result = rollCoreMechanic(4, makeDeps(4))
    expect(result?.total).toBe(8)
    expect(result?.label).toBe('Tough Choice')
  })

  test('applies a negative modifier', () => {
    // roll 8 - 5 = 3 → Failure band
    const result = rollCoreMechanic(-5, makeDeps(8))
    expect(result?.total).toBe(3)
    expect(result?.label).toBe('Failure')
  })

  test('clamps a total above 20 to 20 (Nailed it)', () => {
    const result = rollCoreMechanic(10, makeDeps(18))
    expect(result?.total).toBe(20)
    expect(result?.label).toBe('Nailed it')
  })

  test('clamps a total below 1 to 1 (Cascade Failure)', () => {
    const result = rollCoreMechanic(-10, makeDeps(3))
    expect(result?.total).toBe(1)
    expect(result?.label).toBe('Cascade Failure')
  })

  test('preserves the raw roll separately from the modified total', () => {
    const result = rollCoreMechanic(2, makeDeps(5))
    expect(result?.roll).toBe(5)
    expect(result?.modifier).toBe(2)
    expect(result?.total).toBe(7)
  })
})
