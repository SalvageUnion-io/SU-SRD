/**
 * Unit tests for rollTableHelpers — pure logic, dep-injection only.
 *
 * Does NOT use `mock.module()` because Bun's module mocks leak globally
 * across test files in the same process and break sibling tests that
 * import `salvageunion-reference`. Instead the helpers accept a
 * `RollTableDeps` parameter that we stub directly per test.
 */

import { describe, expect, test } from 'bun:test'
import { rollForPilotField } from 'component-lib'
import type { RollTableDeps } from 'component-lib'

type StubTable = {
  id: string
  name: string
  schemaName: 'roll-tables'
  table: Record<string, { value: string; label?: string }>
}

function makeDeps(table: StubTable | undefined, roll: number): RollTableDeps {
  return {
    findTable: () => table as never,
    rollD20: () => roll,
  }
}

describe('rollForPilotField', () => {
  test('returns null when table is not found', () => {
    const result = rollForPilotField('callsign', makeDeps(undefined, 5))
    expect(result).toBeNull()
  })

  test('returns null when table exists but has no matching roll result', () => {
    const result = rollForPilotField(
      'callsign',
      makeDeps(
        { id: 'rt-callsign', name: 'Callsign Table', schemaName: 'roll-tables', table: {} },
        5
      )
    )
    expect(result).toBeNull()
  })

  test('returns the rolled value for a valid roll', () => {
    const result = rollForPilotField(
      'callsign',
      makeDeps(
        {
          id: 'rt-callsign',
          name: 'Callsign Table',
          schemaName: 'roll-tables',
          table: { '5': { value: 'Ghost' } },
        },
        5
      )
    )
    expect(result).toBe('Ghost')
  })

  test('prefixes label when entry has both label and value', () => {
    const result = rollForPilotField(
      'motto',
      makeDeps(
        {
          id: 'rt-motto',
          name: 'Motto',
          schemaName: 'roll-tables',
          table: { '7': { label: 'Bold', value: 'Forward, always' } },
        },
        7
      )
    )
    expect(result).toBe('Bold: Forward, always')
  })

  test('uses bare value when entry has no label', () => {
    const result = rollForPilotField(
      'keepsake',
      makeDeps(
        {
          id: 'rt-keepsake',
          name: 'Keepsake',
          schemaName: 'roll-tables',
          table: { '12': { value: 'A tarnished medal' } },
        },
        12
      )
    )
    expect(result).toBe('A tarnished medal')
  })

  test('navigates a columns-type table (Callsign Table) via two rolls', () => {
    // The real Callsign Table is `type: columns`, keyed 1-4 / 5-8 / … A flat
    // resultForTable can't walk it and returns failure → the roll button no-ops.
    // Both d20 rolls stub to 5: column roll 5 → the "5-8" column, entry roll 5 → "5".
    const columnsTable = {
      id: 'rt-callsign',
      name: 'Callsign Table',
      schemaName: 'roll-tables' as const,
      table: {
        type: 'columns',
        '5-8': { '5': { value: 'Candyman' } },
      },
    }
    const result = rollForPilotField('callsign', {
      findTable: () => columnsTable as never,
      rollD20: () => 5,
    })
    expect(result).toBe('Candyman')
  })
})
