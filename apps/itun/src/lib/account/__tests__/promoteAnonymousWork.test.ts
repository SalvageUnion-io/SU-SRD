/**
 * Promoting anonymous work into an account (ADR-034 decision 1, plan phase P3).
 *
 * Two properties matter here and they pull in opposite directions: everything
 * the visitor built must reach the server, and **nothing they did not ask to
 * upload may reach it**. The second is the one with a rule behind it — see
 * `AnonymousWorkPromoter`'s header on why an existing roster is offered rather
 * than promoted.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { useEntityStore } from '../../../stores/entityStore'
import {
  captureAnonymousWork,
  countAnonymousWork,
  promoteAnonymousWork,
} from '../promoteAnonymousWork'

/** A claimLocal stand-in that records what it was handed. */
function recordingClaim() {
  const calls: Record<string, unknown>[] = []
  const fn = async (args: Record<string, unknown>) => {
    calls.push(args)
    return { claimed: 0, skipped: 0, alreadyPresent: 0, byKind: {} }
  }
  return { fn, calls }
}

afterEach(async () => {
  // The entity store is a module singleton; leaving rows behind would leak into
  // the next file (see .claude/rules/testing-patterns.md on process-global state).
  const store = useEntityStore.getState()
  for (const type of ['pilot', 'mech', 'crawler'] as const) {
    for (const row of store.list(type)) await store.forget(type, row.id)
  }
})

describe('countAnonymousWork', () => {
  test('counts builds, not wiring', () => {
    const n = countAnonymousWork({
      pilots: [{}, {}],
      mechs: [{}],
      crawlers: [],
      softLinks: [{}, {}, {}],
      mechPatterns: [{}],
    })

    // 2 pilots + 1 mech + 1 pattern. The three soft links are deliberately not
    // counted: they are wiring between things rather than things, so including
    // them would make the banner say "7 builds" for a roster of four.
    expect(n).toBe(4)
  })

  test('an empty capture is zero, so the banner stays away', () => {
    expect(
      countAnonymousWork({
        pilots: [],
        mechs: [],
        crawlers: [],
        softLinks: [],
        mechPatterns: [],
      })
    ).toBe(0)
  })
})

describe('captureAnonymousWork', () => {
  test('reads what the store is holding', async () => {
    // `adopt` rather than `create`: this test is about the capture, and adopt
    // takes a whole record so the shared fixture can be used verbatim instead
    // of hand-rolling a Pilot the schema would reject.
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'cap-1' }))

    const work = captureAnonymousWork()
    expect(work.pilots).toHaveLength(1)
  })
})

describe('promoteAnonymousWork', () => {
  test('hands every kind to the server, wiring included', async () => {
    const claim = recordingClaim()
    const work = {
      pilots: [{ id: 'p1' }],
      mechs: [{ id: 'm1' }],
      crawlers: [{ id: 'c1' }],
      softLinks: [{ id: 'l1' }],
      mechPatterns: [{ id: 'pat1' }],
    }

    await promoteAnonymousWork(claim.fn as never, work)

    // Soft links and patterns are excluded from the *count* but must still be
    // sent — a roster that arrives unwired, or without its saved patterns, is a
    // partial save presented as a complete one.
    const sent = claim.calls[0]
    expect(sent?.pilots).toHaveLength(1)
    expect(sent?.mechs).toHaveLength(1)
    expect(sent?.crawlers).toHaveLength(1)
    expect(sent?.softLinks).toHaveLength(1)
    expect(sent?.mechPatterns).toHaveLength(1)
  })

  test('a local cache failure does NOT fail the save', async () => {
    const claim = recordingClaim()

    // `{ id: 'p1' }` does not parse as a Pilot, so adoption throws. The server
    // write already landed, so this must still resolve: reporting a failure
    // after a successful save is how one save becomes two.
    const result = await promoteAnonymousWork(claim.fn as never, {
      pilots: [{ id: 'p1' }],
      mechs: [],
      crawlers: [],
      softLinks: [],
      mechPatterns: [],
    })

    expect(result.claimed).toBe(0)
    expect(claim.calls).toHaveLength(1)
  })

  test('a server refusal propagates rather than being swallowed', async () => {
    const failing = async () => {
      throw new Error('nope')
    }

    // The caller reports this and leaves the work in the caches. Swallowing it
    // would show a saved roster that the server never received — the exact
    // silent-divergence failure ADR-034 exists to end.
    await expect(
      promoteAnonymousWork(failing as never, {
        pilots: [{ id: 'p1' }],
        mechs: [],
        crawlers: [],
        softLinks: [],
        mechPatterns: [],
      })
    ).rejects.toThrow('nope')
  })

  test('an empty promotion still calls through, and asks for nothing', async () => {
    const claim = recordingClaim()
    await promoteAnonymousWork(claim.fn as never, {
      pilots: [],
      mechs: [],
      crawlers: [],
      softLinks: [],
      mechPatterns: [],
    })

    expect(claim.calls).toHaveLength(1)
    expect(claim.calls[0]?.pilots).toEqual([])
  })
})
