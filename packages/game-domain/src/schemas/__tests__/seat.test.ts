import { describe, expect, test } from 'bun:test'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
import {
  CORE_ROLL_BAND_NAMES,
  isPresent,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STALE_MS,
  PRESENCE_WRITE_MIN_MS,
} from '../seat'

describe('seat roll bands', () => {
  test('are the Core Mechanic bands the rules package names', () => {
    // `convex/schema.ts` builds its roll-band union from this list, so this is
    // the one place it can part from the rules.
    const names: string[] = [...CORE_ROLL_BAND_NAMES]
    expect(names.sort()).toEqual(Object.keys(CORE_ROLL_BANDS).sort())
  })
})

describe('presence', () => {
  test('every beat the client sends can land, and one missed beat is not absence', () => {
    expect(PRESENCE_WRITE_MIN_MS).toBeLessThan(PRESENCE_HEARTBEAT_MS)
    expect(PRESENCE_STALE_MS).toBeGreaterThan(PRESENCE_HEARTBEAT_MS + PRESENCE_WRITE_MIN_MS)
  })

  test('present while the last beat is younger than the stale window', () => {
    expect(isPresent(1_000, 1_000 + PRESENCE_STALE_MS - 1)).toBe(true)
    expect(isPresent(1_000, 1_000 + PRESENCE_STALE_MS)).toBe(false)
    expect(isPresent(null, 1_000)).toBe(false)
    expect(isPresent(undefined, 1_000)).toBe(false)
  })
})
