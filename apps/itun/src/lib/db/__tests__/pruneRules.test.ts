/**
 * The rule that decides whether a cached row may be deleted (P4b).
 *
 * Pruning is the most destructive operation in the codebase, and its guard is
 * the kind that looks like defensive noise right up until the day it is
 * removed. So the rule is extracted as a pure predicate and tested directly,
 * rather than only being reachable through `ShelfSync`'s effect.
 *
 * The predicate is IMPORTED rather than restated here. An earlier draft copied
 * it into this file, which would have let the rule and its test drift apart in
 * exactly the direction that matters — the test passing while the code deleted
 * the roster.
 */

import { describe, expect, test } from 'bun:test'
import { rowMayBePruned } from '../pruneRules'

describe('a shelf row, or a Game row this browser knows is mine', () => {
  test('a Game row is not pruned on absence alone', () => {
    // An unclaimed pre-gen or the communal crawler: owned by nobody, and
    // therefore never returned by a query scoped to what the caller owns.
    // Pruning against that absence would empty every Game view on the next boot.
    expect(rowMayBePruned({ gameId: 'g1' }, false)).toBe(false)
  })

  test('a Game row this browser knows is mine is prunable', () => {
    // Its version was recorded from `listMine` or the owner's own write, so its
    // absence now means it was deleted or released: the copy is not ours to hold.
    expect(rowMayBePruned({ gameId: 'g1' }, true)).toBe(true)
  })

  test('a shelf row is prunable', () => {
    expect(rowMayBePruned({ gameId: null }, false)).toBe(true)
  })
})
