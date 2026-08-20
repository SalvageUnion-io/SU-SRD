/**
 * The signal that stops `ShelfSync` deleting work `UnsavedWorkBanner` failed to
 * upload.
 *
 * These are small, but the module is deliberately process-global — two
 * root-mounted siblings have to agree and neither owns the other — so the
 * things worth pinning are its lifecycle properties rather than its arithmetic.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import {
  onPromotionStateChange,
  promotionState,
  resetPromotionStateForTesting,
  setPromotionState,
} from '../promotionState'

afterEach(() => {
  // This module is process-global by design, so a leaked `failed` from one test
  // would silently disable pruning for every file that runs after this one —
  // the same hazard `mock.module` has in this repo.
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

  test('notifies subscribers on change', () => {
    let calls = 0
    const off = onPromotionStateChange(() => {
      calls += 1
    })
    setPromotionState('pending')
    expect(calls).toBe(1)
    off()
    setPromotionState('failed')
    expect(calls).toBe(1)
  })

  test('does not notify when the state is unchanged', () => {
    // `ShelfSync`'s effect keys off `mine`; a redundant notification would set
    // up a re-run that re-walks the whole roster for nothing.
    let calls = 0
    onPromotionStateChange(() => {
      calls += 1
    })
    setPromotionState('pending')
    setPromotionState('pending')
    expect(calls).toBe(1)
  })

  test('is readable synchronously, so the prune can check it after an await', () => {
    // `ShelfSync` reads this AFTER its adoption loop has awaited, precisely so
    // it sees a promotion that failed in the meantime. A promise-based API
    // would reintroduce the race the guard exists to close.
    setPromotionState('failed')
    expect(promotionState()).toBe('failed')
  })
})
