/**
 * The signal that stops `ShelfSync` deleting work `UnsavedWorkBanner` failed to
 * upload.
 *
 * Small, but the module is deliberately process-global — two root-mounted
 * siblings have to agree and neither owns the other — so what is worth pinning
 * is its lifecycle, not its arithmetic.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { promotionState, resetPromotionStateForTesting, setPromotionState } from '../promotionState'

afterEach(() => {
  // Process-global by design, so a leaked `failed` from one test would silently
  // disable pruning for every file that runs after this one — and the symptom
  // is a pruning test passing for the wrong reason. Same hazard as
  // `mock.module` in `.claude/rules/testing-patterns.md`.
  resetPromotionStateForTesting()
})

describe('promotionState', () => {
  test('starts idle, so a session that never promotes does not block pruning', () => {
    expect(promotionState()).toBe('idle')
  })

  test('records each state', () => {
    setPromotionState('pending')
    expect(promotionState()).toBe('pending')
    setPromotionState('failed')
    expect(promotionState()).toBe('failed')
    setPromotionState('idle')
    expect(promotionState()).toBe('idle')
  })

  test('is readable synchronously, so the prune can check it after an await', () => {
    // `ShelfSync` reads this AFTER its adoption loop has awaited, precisely so
    // it sees a promotion that failed in the meantime. A promise-based API
    // would reintroduce the race the guard exists to close.
    setPromotionState('failed')
    expect(promotionState()).toBe('failed')
  })

  test('the test reset really resets', () => {
    // This is the load-bearing one: every other file's isolation depends on it.
    setPromotionState('failed')
    resetPromotionStateForTesting()
    expect(promotionState()).toBe('idle')
  })
})
