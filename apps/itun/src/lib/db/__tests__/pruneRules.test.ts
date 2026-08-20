/**
 * The rules that decide whether a cached row may be deleted (P4b).
 *
 * Pruning is the most destructive operation in the codebase, and every one of
 * its guards is the kind that looks like defensive noise right up until the day
 * it is removed. So the rules are extracted as pure predicates and tested
 * directly, rather than only being reachable through `ShelfSync`'s effect.
 *
 * The scenarios below are the three ways to delete somebody's roster by
 * accident. Rule 3 was added after the third one was found in production code:
 * unlike the other two it did not merely risk deletion, it performed it — a
 * failed promotion left work local, and the prune then read that as "deleted
 * elsewhere".
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
    expect(mayPrune('present', 'idle')).toBe(false)
  })

  test('an unresolved probe is refused too', () => {
    // Same failure, arrived at by racing rather than by state: the probe has
    // not answered, so "no legacy roster" is not yet known to be true.
    expect(mayPrune('unknown', 'idle')).toBe(false)
  })

  test('a browser that never held one may prune', () => {
    expect(mayPrune('absent', 'idle')).toBe(true)
  })
})

describe('rule 3 — un-promoted anonymous work is never pruned', () => {
  // The scenario, and it destroyed work rather than merely risking it: a brand
  // new visitor builds anonymously, signs in, and promotion FAILS. They have no
  // pre-ADR-034 roster, so `legacy` is legitimately 'absent' and rule 1 waves
  // them through. Their builds are shelf rows the server never received, so
  // they are absent from `listMine` and rule 2 says prunable. The prune then
  // deletes exactly the work the error banner was reporting on.
  test('a failed promotion blocks pruning', () => {
    expect(mayPrune('absent', 'failed')).toBe(false)
  })

  test('an in-flight promotion blocks pruning', () => {
    // The rows have not reached the server YET. Absence here means "still
    // uploading", which is the same wrong answer as "never arrived".
    expect(mayPrune('absent', 'pending')).toBe(false)
  })

  test('the guard is not satisfied by the legacy state alone', () => {
    // Guards against a refactor that keeps the parameter and ignores it: the
    // ONLY combination that prunes is absent + idle.
    expect(mayPrune('absent', 'idle')).toBe(true)
    expect(mayPrune('absent', 'pending')).toBe(false)
    expect(mayPrune('absent', 'failed')).toBe(false)
    expect(mayPrune('present', 'idle')).toBe(false)
    expect(mayPrune('unknown', 'idle')).toBe(false)
  })
})

describe('rule 2 — only shelf rows are prunable', () => {
  test("a Game's row is never pruned, even though it is absent from listMine", () => {
    // An unclaimed pre-gen or the communal crawler: cached on purpose by
    // `GameRoster`, owned by nobody, and therefore never returned by a query
    // scoped to what the caller owns. Pruning against that absence would empty
    // every Game view on the next boot.
    expect(rowMayBePruned({ gameId: 'g1' })).toBe(false)
  })

  test('a shelf row is prunable', () => {
    expect(rowMayBePruned({ gameId: null })).toBe(true)
  })

  test('a pre-ADR-030 record resolves through workspaceId, like every other reader', () => {
    // `containerOf` rather than a bare `gameId === null` check, so a record
    // written before the container split is classified the same way the rest of
    // the app classifies it — a Game-shaped one is protected.
    expect(rowMayBePruned({ workspaceId: 'ws-1' })).toBe(false)
    expect(rowMayBePruned({ workspaceId: 'default-workspace' })).toBe(true)
  })
})

describe('both rules together', () => {
  test('a Game row survives even in a prunable browser', () => {
    expect(mayPrune('absent', 'idle') && rowMayBePruned({ gameId: 'g1' })).toBe(false)
  })

  test('a shelf row survives in a legacy browser', () => {
    expect(mayPrune('present', 'idle') && rowMayBePruned({ gameId: null })).toBe(false)
  })

  test('only the intended case deletes', () => {
    expect(mayPrune('absent', 'idle') && rowMayBePruned({ gameId: null })).toBe(true)
  })
})
