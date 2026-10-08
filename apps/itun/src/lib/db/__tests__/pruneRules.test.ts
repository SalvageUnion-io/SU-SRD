/**
 * The rules that decide whether a cached row may be deleted (P4b).
 *
 * Pruning is the most destructive operation in the codebase, and every one of
 * its guards is the kind that looks like defensive noise right up until the day
 * it is removed. So the rules are extracted as pure predicates and tested
 * directly, rather than only being reachable through `ShelfSync`'s effect.
 *
 * The scenarios below are the ways to delete somebody's roster by accident.
 * There was a third rule, for anonymous work a failed upload left local after
 * sign-in; signing out is read-only now, so no such work can exist.
 *
 * The predicates are IMPORTED rather than restated here. An earlier draft copied
 * them into this file, which would have let the rule and its test drift apart in
 * exactly the direction that matters — the test passing while the code deleted
 * the roster.
 */

import { describe, expect, test } from 'bun:test'
import { mayPrune, rowMayBePruned } from '../pruneRules'

describe('rule 1 — a browser that held a legacy roster never prunes', () => {
  test('a legacy browser is refused', () => {
    // The scenario: a pre-ADR-034 player signs in for the first time and has
    // not claimed yet. Every build they own is a local shelf row the server has
    // never seen. Pruning here deletes all of it.
    expect(mayPrune('present')).toBe(false)
  })

  test('an unresolved probe is refused too', () => {
    // Same failure, arrived at by racing rather than by state: the probe has
    // not answered, so "no legacy roster" is not yet known to be true.
    expect(mayPrune('unknown')).toBe(false)
  })

  test('a browser that never held one may prune', () => {
    expect(mayPrune('absent')).toBe(true)
  })
})

describe('rule 2 — a shelf row, or a Game row this browser knows is mine', () => {
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

  test('a pre-ADR-030 record resolves through workspaceId, like every other reader', () => {
    // `containerOf` rather than a bare `gameId === null` check, so a record
    // written before the container split is classified the same way the rest of
    // the app classifies it — a Game-shaped one is protected.
    expect(rowMayBePruned({ workspaceId: 'ws-1' }, false)).toBe(false)
    expect(rowMayBePruned({ workspaceId: 'default-workspace' }, false)).toBe(true)
  })
})

describe('both rules together', () => {
  test('a Game row not known to be mine survives even in a prunable browser', () => {
    expect(mayPrune('absent') && rowMayBePruned({ gameId: 'g1' }, false)).toBe(false)
  })

  test('a known-mine row survives in a legacy browser', () => {
    expect(mayPrune('present') && rowMayBePruned({ gameId: null }, false)).toBe(false)
    expect(mayPrune('present') && rowMayBePruned({ gameId: 'g1' }, true)).toBe(false)
  })

  test('only the intended cases delete', () => {
    expect(mayPrune('absent') && rowMayBePruned({ gameId: null }, false)).toBe(true)
    expect(mayPrune('absent') && rowMayBePruned({ gameId: 'g1' }, true)).toBe(true)
  })
})
