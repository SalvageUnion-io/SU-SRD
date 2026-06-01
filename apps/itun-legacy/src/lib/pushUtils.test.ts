import { describe, test, expect } from 'bun:test'
import { canPush, computePush } from './pushUtils'

// ---------------------------------------------------------------------------
// canPush — UI-layer gate: returns true when currentHeat < heatCap
// Pushing is allowed whenever heat is below cap; already-at-cap = blocked.
// ---------------------------------------------------------------------------

describe('canPush', () => {
  test('returns true when heat is 0 (well below cap)', () => {
    expect(canPush(0, 10)).toBe(true)
  })

  test('returns true when heat is below cap', () => {
    expect(canPush(5, 10)).toBe(true)
  })

  test('returns true when heat is one below cap (pushing to cap is allowed)', () => {
    expect(canPush(9, 10)).toBe(true)
  })

  test('returns false when heat equals cap (already at cap)', () => {
    expect(canPush(10, 10)).toBe(false)
  })

  test('returns false when heat exceeds cap', () => {
    expect(canPush(11, 10)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computePush — adds 2 heat, clamps to cap, checks heat check threshold
// ---------------------------------------------------------------------------

describe('computePush', () => {
  test('normal push: adds 2 heat, no heat check triggered', () => {
    const result = computePush(3, 10)
    expect(result.newHeat).toBe(5)
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('push that lands exactly at cap triggers heat check', () => {
    // 8 + 2 = 10, cap = 10 — boundary case
    const result = computePush(8, 10)
    expect(result.newHeat).toBe(10)
    expect(result.heatCheckTriggered).toBe(true)
  })

  test('push that would exceed cap clamps to cap and triggers heat check', () => {
    // 9 + 2 = 11 → clamps to 10
    const result = computePush(9, 10)
    expect(result.newHeat).toBe(10)
    expect(result.heatCheckTriggered).toBe(true)
  })

  test('push from 0 with large cap does not trigger heat check', () => {
    const result = computePush(0, 20)
    expect(result.newHeat).toBe(2)
    expect(result.heatCheckTriggered).toBe(false)
  })

  test('push at one below trigger boundary does not trigger heat check', () => {
    // 7 + 2 = 9, cap = 10 — stays below cap
    const result = computePush(7, 10)
    expect(result.newHeat).toBe(9)
    expect(result.heatCheckTriggered).toBe(false)
  })
})
