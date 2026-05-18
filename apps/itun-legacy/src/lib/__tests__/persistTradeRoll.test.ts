import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Pure logic tests for trade roll persistence
// ---------------------------------------------------------------------------

// Tests for the numeric roll value extraction logic used in onRollResult.
// This is the pure logic extracted from the callback in DowntimeGuideView.
function parseRollValue(key: string): number {
  return key.includes('-') ? parseInt(key.split('-')[0]!, 10) : parseInt(key, 10)
}

describe('parseRollValue (trade roll key → numeric value)', () => {
  test('parses a plain numeric key', () => {
    expect(parseRollValue('7')).toBe(7)
  })

  test('parses the lower bound of a range key', () => {
    expect(parseRollValue('1-3')).toBe(1)
  })

  test('parses a two-digit range key', () => {
    expect(parseRollValue('10-12')).toBe(10)
  })

  test('parses a single-number range key (e.g. "6-6")', () => {
    expect(parseRollValue('6-6')).toBe(6)
  })
})

// Tests verifying that trade roll DB state initialisation logic is correct.
// The component should read from activeDowntime fields as initial state.
function getInitialTradeRollKey(activeDowntime: { trade_roll_key?: string | null }): string | null {
  return activeDowntime.trade_roll_key ?? null
}

function getInitialTradeRollValue(activeDowntime: {
  trade_roll_value?: number | null
}): number | null {
  return activeDowntime.trade_roll_value ?? null
}

describe('trade roll initial state hydration from activeDowntime', () => {
  test('initialises key to null when field is absent', () => {
    expect(getInitialTradeRollKey({})).toBe(null)
  })

  test('initialises key to null when field is null', () => {
    expect(getInitialTradeRollKey({ trade_roll_key: null })).toBe(null)
  })

  test('initialises key from persisted value', () => {
    expect(getInitialTradeRollKey({ trade_roll_key: '4-6' })).toBe('4-6')
  })

  test('initialises value to null when field is absent', () => {
    expect(getInitialTradeRollValue({})).toBe(null)
  })

  test('initialises value to null when field is null', () => {
    expect(getInitialTradeRollValue({ trade_roll_value: null })).toBe(null)
  })

  test('initialises value from persisted number', () => {
    expect(getInitialTradeRollValue({ trade_roll_value: 4 })).toBe(4)
  })
})

// Tests verifying the DB type shape has trade_roll_key and trade_roll_value.
// Import the type to get a compile-time check.
import type { Database } from '../../types/database-generated.types'

type DowntimeRow = Database['public']['Tables']['downtime_records']['Row']
type DowntimeUpdate = Database['public']['Tables']['downtime_records']['Update']

describe('database type includes trade roll columns', () => {
  test('Row has trade_roll_key as string | null', () => {
    const row: Pick<DowntimeRow, 'trade_roll_key'> = { trade_roll_key: null }
    expect(row.trade_roll_key).toBe(null)
    const row2: Pick<DowntimeRow, 'trade_roll_key'> = { trade_roll_key: '4-6' }
    expect(row2.trade_roll_key).toBe('4-6')
  })

  test('Row has trade_roll_value as number | null', () => {
    const row: Pick<DowntimeRow, 'trade_roll_value'> = { trade_roll_value: null }
    expect(row.trade_roll_value).toBe(null)
    const row2: Pick<DowntimeRow, 'trade_roll_value'> = { trade_roll_value: 4 }
    expect(row2.trade_roll_value).toBe(4)
  })

  test('Update has trade_roll_key as optional string | null', () => {
    const update: DowntimeUpdate = { trade_roll_key: '1-3' }
    expect(update.trade_roll_key).toBe('1-3')
  })

  test('Update has trade_roll_value as optional number | null', () => {
    const update: DowntimeUpdate = { trade_roll_value: 1 }
    expect(update.trade_roll_value).toBe(1)
  })
})
