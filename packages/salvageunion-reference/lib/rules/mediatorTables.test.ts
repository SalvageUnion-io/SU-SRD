/**
 * Mediator tables (Reaction / Morale / Retreat) — pure logic tests.
 * The d20 and the reference-table lookup are both injected, so every case is
 * deterministic and needs no preloaded game data.
 */

import { describe, expect, test } from 'bun:test'
import type { FindRollTable } from './mediatorTables.js'
import {
  describeMediatorRoll,
  MEDIATOR_TABLE_NAMES,
  performMediatorRoll,
} from './mediatorTables.js'

/** Band shape mirroring the real Workshop Manual p.268 tables. */
const FAKE_TABLES: Record<string, { table: Record<string, unknown> }> = {
  'Reaction Roll': {
    table: {
      '1': { label: 'Actively Hostile', value: 'They attack on sight.' },
      '2-5': { label: 'Hostile', value: 'They threaten the group.' },
      '6-10': { label: 'Unfriendly', value: 'They are difficult to deal with.' },
      '11-19': { label: 'Friendly', value: 'They will talk and trade.' },
      '20': { label: 'Actively Helpful and Friendly', value: 'They actively help.' },
      type: 'standard',
    },
  },
  Morale: {
    table: {
      '1': { label: 'Surrender', value: 'The NPCs surrender.' },
      '2-5': { label: 'Retreat', value: 'The NPCs flee.' },
      '6-10': { label: 'Fighting Retreat', value: 'They fight one more round, then retreat.' },
      '11-19': { label: 'Keep Fighting', value: 'They continue to fight.' },
      '20': { label: 'Fight to the Death', value: 'They never retreat.' },
      type: 'standard',
    },
  },
  Retreat: {
    table: {
      '1': { label: 'Disastrous Escape', value: 'Severe Setback, may be pursued.' },
      '2-5': { label: 'Failed Escape', value: 'Pinned down, must fight it out.' },
      '6-10': { label: 'Dangerous Escape', value: 'Escape at the cost of a Tough Choice.' },
      '11-19': { label: 'Escape', value: 'Safe escape to an adjacent location.' },
      '20': { label: 'Perfect Escape', value: 'Perfect escape, cannot be pursued.' },
      type: 'standard',
    },
  },
}

const findTable: FindRollTable = (name) => FAKE_TABLES[name]

const fixedRoll = (value: number) => () => value
const fixedNow = () => new Date('2026-07-01T12:00:00.000Z')

describe('performMediatorRoll — band resolution', () => {
  test('reaction 1 lands in the Actively Hostile band', () => {
    const result = performMediatorRoll({
      table: 'reaction',
      roll: fixedRoll(1),
      findTable,
      now: fixedNow,
    })
    expect(result).toEqual({
      table: 'reaction',
      roll: 1,
      label: 'Actively Hostile',
      value: 'They attack on sight.',
      rolledAt: '2026-07-01T12:00:00.000Z',
    })
  })

  test.each([
    [2, 'Hostile'],
    [5, 'Hostile'],
    [6, 'Unfriendly'],
    [10, 'Unfriendly'],
    [11, 'Friendly'],
    [19, 'Friendly'],
    [20, 'Actively Helpful and Friendly'],
  ] as const)('reaction %i → %s', (roll, label) => {
    const result = performMediatorRoll({
      table: 'reaction',
      roll: fixedRoll(roll),
      findTable,
      now: fixedNow,
    })
    expect(result?.label).toBe(label)
    expect(result?.roll).toBe(roll)
  })

  test('morale 6 → Fighting Retreat', () => {
    const result = performMediatorRoll({
      table: 'morale',
      roll: fixedRoll(6),
      findTable,
      now: fixedNow,
    })
    expect(result?.label).toBe('Fighting Retreat')
    expect(result?.table).toBe('morale')
  })

  test('retreat 20 → Perfect Escape', () => {
    const result = performMediatorRoll({
      table: 'retreat',
      roll: fixedRoll(20),
      findTable,
      now: fixedNow,
    })
    expect(result?.label).toBe('Perfect Escape')
    expect(result?.value).toBe('Perfect escape, cannot be pursued.')
  })
})

describe('performMediatorRoll — failure paths', () => {
  test('returns null when the table cannot be found', () => {
    const result = performMediatorRoll({
      table: 'reaction',
      roll: fixedRoll(10),
      findTable: () => undefined,
      now: fixedNow,
    })
    expect(result).toBeNull()
  })

  test('returns null when the roll does not resolve against the table', () => {
    const result = performMediatorRoll({
      table: 'reaction',
      roll: fixedRoll(10),
      findTable: () => ({ table: { type: 'standard' } }),
      now: fixedNow,
    })
    expect(result).toBeNull()
  })
})

describe('table-name mapping', () => {
  test('ids map to the reference roll-table names', () => {
    expect(MEDIATOR_TABLE_NAMES).toEqual({
      reaction: 'Reaction Roll',
      morale: 'Morale',
      retreat: 'Retreat',
    })
  })
})

describe('describeMediatorRoll', () => {
  test('includes table label, roll, band, and outcome text', () => {
    expect(
      describeMediatorRoll({
        table: 'morale',
        roll: 3,
        label: 'Retreat',
        value: 'The NPCs flee.',
        rolledAt: '2026-07-01T12:00:00.000Z',
      })
    ).toBe('Morale: rolled 3 — Retreat. The NPCs flee.')
  })

  test('omits the band when the entry has no label', () => {
    expect(
      describeMediatorRoll({
        table: 'retreat',
        roll: 12,
        value: 'Safe escape.',
        rolledAt: '2026-07-01T12:00:00.000Z',
      })
    ).toBe('Retreat: rolled 12. Safe escape.')
  })
})
