/**
 * The local → account reconciler's rule (ADR-034 decision 1, ADR-035).
 *
 * Two properties matter and they pull in opposite directions: everything the
 * player asked to keep must reach the server, and a result that RESOLVED must
 * still be read for rows that did not land.
 */

import { describe, expect, test } from 'bun:test'
import type { StrandedWork } from '../legacyMigration'
import { reconcile, strandedCount } from '../reconcile'

const EMPTY: StrandedWork = {
  pilots: [],
  mechs: [],
  crawlers: [],
  softLinks: [],
  mechPatterns: [],
  encounterNpcs: [],
}

/** A claimLocal stand-in that records what it was handed. */
function recordingClaim(
  result: { claimed: number; skipped: number; alreadyPresent: number } = {
    claimed: 0,
    skipped: 0,
    alreadyPresent: 0,
  }
) {
  const calls: Record<string, unknown>[] = []
  const fn = async (args: Record<string, unknown>) => {
    calls.push(args)
    return { strandedIds: [], ...result, declined: 0, byKind: {} }
  }
  return { fn, calls }
}

describe('reconcile', () => {
  test('hands every kind to the server, wiring and NPCs included', async () => {
    const claim = recordingClaim()
    await reconcile(claim.fn as never, {
      pilots: [{ id: 'p1' }],
      mechs: [{ id: 'm1' }],
      crawlers: [{ id: 'c1' }],
      softLinks: [{ id: 'l1' }],
      mechPatterns: [{ id: 'pat1' }],
      encounterNpcs: [{ id: 'npc1' }],
    })

    // Excluded from the count is not excluded from the save: a roster that
    // arrives unwired, or without its patterns and tray, is a partial save
    // presented as a complete one.
    const sent = claim.calls[0]
    for (const kind of Object.keys(EMPTY)) expect(sent?.[kind]).toHaveLength(1)
  })

  test('a server refusal propagates rather than being swallowed', async () => {
    const failing = async () => {
      throw new Error('nope')
    }

    // Swallowing it would show a saved roster the server never received — the
    // exact silent divergence ADR-034 exists to end.
    await expect(reconcile(failing as never, { ...EMPTY, pilots: [{ id: 'p1' }] })).rejects.toThrow(
      'nope'
    )
  })

  test('a resolved-but-partial result reports what did not land', async () => {
    const claim = recordingClaim({ claimed: 2, skipped: 1, alreadyPresent: 1 })
    const result = await reconcile(claim.fn as never, EMPTY)
    expect(result).toEqual({ claimed: 2, stranded: 2 })
  })
})

/**
 * `claimLocal` does not throw on per-row failure: a body that fails Zod is
 * `skipped`, an app id already present anywhere is `alreadyPresent`. Both leave
 * the row local and absent from the server — what the prune reads as "deleted
 * elsewhere" — so a resolved call must still be read. These pin the arithmetic.
 */
describe('strandedCount', () => {
  test('a fully-claimed result strands nothing', () => {
    expect(strandedCount({ skipped: 0, alreadyPresent: 0 })).toBe(0)
  })

  test('skipped and already-present rows are both stranded', () => {
    expect(strandedCount({ skipped: 1, alreadyPresent: 0 })).toBe(1)
    expect(strandedCount({ skipped: 0, alreadyPresent: 1 })).toBe(1)
  })

  test('declined rows are not — they are somebody else’s, and already safe', () => {
    // The argument type has no `declined` at all: counting them would hold the
    // migration window open forever over rows that were never at risk.
    expect(strandedCount.length).toBe(1)
  })
})
