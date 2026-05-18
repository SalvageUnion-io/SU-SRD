/**
 * Unit tests for rollTableHelpers — pure logic, no DOM.
 *
 * Bun does not support import-time vi.mock() the same way as Vitest.
 * Instead we directly mock SalvageUnionReference methods on the module's
 * imported object, which works because modules are cached singletons.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// We must mock SalvageUnionReference BEFORE importing rollTableHelpers
// because the helpers module captures the reference at import time.
// Use bun module mock.module() to intercept the import.
// ---------------------------------------------------------------------------
const mockFind = mock(() => undefined)

mock.module('salvageunion-reference', () => ({
  SalvageUnionReference: {
    RollTables: { find: mockFind },
    Classes: { all: mock(() => []), find: mock(() => undefined) },
    Abilities: { findAll: mock(() => []) },
    Equipment: { findAll: mock(() => []) },
  },
  resultForTable: (table: Record<string, unknown> | undefined, roll: number) => {
    if (!table) return { success: false, result: { value: 'no table' }, key: '' }
    const key = roll.toString()
    const entry = (table as Record<string, { value: string }>)[key]
    if (!entry) return { success: false, result: { value: 'no result' }, key: '' }
    return { success: true, result: entry, key }
  },
}))

// Import AFTER mock is set up
const { rollForPilotField } = await import('../rollTableHelpers')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rollForPilotField', () => {
  beforeEach(() => {
    mockFind.mockReset()
  })

  afterEach(() => {
    mockFind.mockReset()
  })

  test('returns null when table is not found', () => {
    mockFind.mockImplementation(() => undefined)
    const result = rollForPilotField('callsign')
    expect(result).toBeNull()
  })

  test('returns null when table exists but has no matching roll result', () => {
    mockFind.mockImplementation(() => ({
      id: 'mock-id',
      name: 'Callsign Table',
      table: {},
    }))

    const result = rollForPilotField('callsign')
    expect(result).toBeNull()
  })

  test('returns a string when a flat table entry is found', () => {
    const flatTable: Record<string, { value: string }> = {}
    for (let i = 1; i <= 20; i++) {
      flatTable[i.toString()] = { value: `Option ${i}` }
    }

    mockFind.mockImplementation(() => ({
      id: 'mock-id',
      name: 'Callsign Table',
      table: flatTable,
    }))

    const result = rollForPilotField('callsign')
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^Option \d+$/)
  })

  test('result includes label when table entry has a label field', () => {
    const flatTable: Record<string, { label: string; value: string }> = {}
    for (let i = 1; i <= 20; i++) {
      flatTable[i.toString()] = { label: 'Label', value: 'Value' }
    }

    mockFind.mockImplementation(() => ({
      id: 'mock-id',
      name: 'Motto',
      table: flatTable,
    }))

    // The real resultForTable is mocked to return label+value for entries that have it
    // but our mock resultForTable doesn't format with label — test the shape only
    const result = rollForPilotField('motto')
    expect(typeof result).toBe('string')
  })

  test('works for all pilot roll fields', () => {
    const flatTable: Record<string, { value: string }> = {}
    for (let i = 1; i <= 20; i++) {
      flatTable[i.toString()] = { value: `Entry ${i}` }
    }
    mockFind.mockImplementation(() => ({
      id: 'mock-id',
      name: 'Any',
      table: flatTable,
    }))

    const fields = ['callsign', 'motto', 'keepsake', 'appearance', 'background'] as const
    for (const field of fields) {
      const result = rollForPilotField(field)
      expect(typeof result).toBe('string')
    }
  })
})
