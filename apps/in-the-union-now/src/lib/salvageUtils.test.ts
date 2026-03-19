import { describe, expect, test } from 'bun:test'
import { validateSalvageCondition, resolveSalvageRoll, computeCargoFit } from './salvageUtils'
import type { SalvageCondition } from './salvageUtils'
import type { CargoRow } from '../types/common'

// --- validateSalvageCondition ---

describe('validateSalvageCondition', () => {
  test('intact allows salvage', () => {
    expect(validateSalvageCondition('intact')).toBe(true)
  })

  test('damaged allows salvage', () => {
    expect(validateSalvageCondition('damaged')).toBe(true)
  })

  test('destroyed does not allow salvage', () => {
    expect(validateSalvageCondition('destroyed')).toBe(false)
  })

  test('all SalvageCondition values are handled', () => {
    const conditions: SalvageCondition[] = ['intact', 'damaged', 'destroyed']
    const results = conditions.map(validateSalvageCondition)
    expect(results).toEqual([true, true, false])
  })
})

// --- resolveSalvageRoll ---

describe('resolveSalvageRoll', () => {
  test('resolves Area Salvage table for a valid roll', () => {
    const result = resolveSalvageRoll('Area Salvage', 10)
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.result).toBeDefined()
    expect(typeof result.result.value).toBe('string')
  })

  test('resolves Mech Salvage table for a valid roll', () => {
    const result = resolveSalvageRoll('Mech Salvage', 15)
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    expect(result.result).toBeDefined()
    expect(typeof result.result.value).toBe('string')
  })

  test('roll of 1 returns a result for Area Salvage', () => {
    const result = resolveSalvageRoll('Area Salvage', 1)
    expect(result.success).toBe(true)
  })

  test('roll of 20 returns a result for Mech Salvage', () => {
    const result = resolveSalvageRoll('Mech Salvage', 20)
    expect(result.success).toBe(true)
  })

  test('result key is present', () => {
    const result = resolveSalvageRoll('Area Salvage', 5)
    expect(typeof result.key).toBe('string')
    expect(result.key.length).toBeGreaterThan(0)
  })
})

// --- computeCargoFit ---

describe('computeCargoFit', () => {
  /** Minimal CargoRow stub — only the fields cargoGridUtils needs */
  function makeScrapRow(id: string, amount: number): CargoRow {
    return {
      id,
      name: `${amount}TL1 Scrap`,
      amount,
      schema_name: null,
      schema_ref_id: null,
      metadata: null,
      parent_id: 'mech-1',
      parent_type: 'mech',
      user_id: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  test('returns full capacity when cargo is empty', () => {
    expect(computeCargoFit([], 10)).toBe(10)
  })

  test('returns 0 when cargo is exactly at capacity', () => {
    // One scrap row with amount=10 consumes 10 cells
    const cargo = [makeScrapRow('c1', 10)]
    expect(computeCargoFit(cargo, 10)).toBe(0)
  })

  test('returns remaining capacity after partial fill', () => {
    const cargo = [makeScrapRow('c1', 3), makeScrapRow('c2', 2)]
    // 3 + 2 = 5 used out of 12
    expect(computeCargoFit(cargo, 12)).toBe(7)
  })

  test('returns 0 for over-capacity (clamped)', () => {
    const cargo = [makeScrapRow('c1', 15)]
    // 15 used, capacity 10 → clamped to 0
    expect(computeCargoFit(cargo, 10)).toBe(0)
  })

  test('handles zero capacity', () => {
    expect(computeCargoFit([], 0)).toBe(0)
  })
})
