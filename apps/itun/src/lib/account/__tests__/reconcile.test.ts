/**
 * The local → account reconciler's rule (ADR-034 decision 1, ADR-035).
 *
 * Two properties matter and they pull in opposite directions: everything the
 * player asked to keep must reach the server, and a result that RESOLVED must
 * still be read for rows that did not land.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { useEntityStore } from '../../../stores/entityStore'
import type { ExportBundle } from '../../schemas/exportBundle'
import type { LocalWork } from '../reconcile'
import {
  captureSessionWork,
  combineBundles,
  countWork,
  reconcile,
  strandedCount,
  withoutIds,
  workIds,
} from '../reconcile'

const EMPTY: LocalWork = {
  pilots: [],
  mechs: [],
  crawlers: [],
  softLinks: [],
  mechPatterns: [],
  encounterNpcs: [],
}

/** A claimLocal stand-in that records what it was handed. */
function recordingClaim(
  result: { claimed: number; skipped: number; alreadyPresent: number; strandedIds?: string[] } = {
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

afterEach(async () => {
  // The entity store is a module singleton; leaving rows behind would leak into
  // the next file (see .claude/rules/testing-patterns.md on process-global state).
  const store = useEntityStore.getState()
  for (const type of ['pilot', 'mech', 'crawler', 'softLink'] as const) {
    for (const row of store.list(type)) await store.forget(type, row.id)
  }
})

describe('countWork', () => {
  test('counts things, not wiring', () => {
    const n = countWork({
      pilots: [{}, {}],
      mechs: [{}],
      crawlers: [],
      softLinks: [{}, {}, {}],
      mechPatterns: [{}],
      encounterNpcs: [{}],
    })

    // 2 pilots + 1 mech + 1 pattern + 1 NPC. The three soft links are wiring
    // between things, so counting them would say "8 builds" for five.
    expect(n).toBe(5)
  })

  test('nothing held is zero, so the banner stays away', () => {
    expect(countWork(EMPTY)).toBe(0)
  })
})

describe('captureSessionWork', () => {
  test('reads what the stores are holding, synchronously', async () => {
    await useEntityStore.getState().adopt('pilot', pilotFixture({ id: 'cap-1' }))

    const work = captureSessionWork()
    expect(work.pilots).toHaveLength(1)
    expect(Array.isArray(work.encounterNpcs)).toBe(true)
  })
})

describe('reconcile', () => {
  test('hands every kind to the server, wiring and NPCs included', async () => {
    const claim = recordingClaim()
    await reconcile(
      claim.fn as never,
      {
        pilots: [{ id: 'p1' }],
        mechs: [{ id: 'm1' }],
        crawlers: [{ id: 'c1' }],
        softLinks: [{ id: 'l1' }],
        mechPatterns: [{ id: 'pat1' }],
        encounterNpcs: [{ id: 'npc1' }],
      },
      { adopt: false }
    )

    // Excluded from the count is not excluded from the save: a roster that
    // arrives unwired, or without its patterns and tray, is a partial save
    // presented as a complete one. NPCs used to be dropped by the anonymous path
    // and sent by the device path — one of the drifts one reconciler removes.
    const sent = claim.calls[0]
    for (const kind of Object.keys(EMPTY)) expect(sent?.[kind]).toHaveLength(1)
  })

  test('a local cache failure does NOT fail the save', async () => {
    const claim = recordingClaim({ claimed: 1, skipped: 0, alreadyPresent: 0 })

    // `{ id: 'p1' }` does not parse as a Pilot, so adoption throws. The server
    // write already landed, so this must still resolve: reporting a failure
    // after a successful save is how one save becomes two.
    const result = await reconcile(
      claim.fn as never,
      { ...EMPTY, pilots: [{ id: 'p1' }] },
      { adopt: true }
    )

    expect(result).toEqual({ claimed: 1, stranded: 0, strandedIds: [] })
  })

  test('adopt: true caches session work under its own id', async () => {
    const claim = recordingClaim({ claimed: 1, skipped: 0, alreadyPresent: 0 })
    await reconcile(
      claim.fn as never,
      { ...EMPTY, pilots: [pilotFixture({ id: 'kept-id' })] },
      { adopt: true }
    )

    expect(
      useEntityStore
        .getState()
        .list('pilot')
        .map((p) => p.id)
    ).toEqual(['kept-id'])
  })

  test('adopt: false leaves the cache alone — device rows are already on disk', async () => {
    const claim = recordingClaim({ claimed: 1, skipped: 0, alreadyPresent: 0 })
    await reconcile(
      claim.fn as never,
      { ...EMPTY, pilots: [pilotFixture({ id: 'device-id' })] },
      { adopt: false }
    )

    expect(useEntityStore.getState().list('pilot')).toEqual([])
  })

  test('a server refusal propagates rather than being swallowed', async () => {
    const failing = async () => {
      throw new Error('nope')
    }

    // Swallowing it would show a saved roster the server never received — the
    // exact silent divergence ADR-034 exists to end.
    await expect(
      reconcile(failing as never, { ...EMPTY, pilots: [{ id: 'p1' }] }, { adopt: true })
    ).rejects.toThrow('nope')
  })

  test('a resolved-but-partial result reports what did not land', async () => {
    const claim = recordingClaim({
      claimed: 2,
      skipped: 1,
      alreadyPresent: 1,
      strandedIds: ['p3', 'p4'],
    })
    const result = await reconcile(claim.fn as never, EMPTY, { adopt: false })
    expect(result).toEqual({ claimed: 2, stranded: 2, strandedIds: ['p3', 'p4'] })
  })

  test('the landed rows of a partial result are the work minus its stranded ids', async () => {
    const work = { ...EMPTY, pilots: [{ id: 'p1' }, { id: 'p2' }, { noId: true }] }
    const claim = recordingClaim({ claimed: 1, skipped: 2, alreadyPresent: 0, strandedIds: ['p2'] })
    const { strandedIds } = await reconcile(claim.fn as never, work, { adopt: false })

    const landed = withoutIds(work, new Set(strandedIds))
    // p1 landed and is recorded; p2 was refused. The id-less row was refused
    // too and the server could not name it — it stays out of what gets
    // recorded, because `workIds` cannot record a row with no id.
    expect([...workIds(landed)]).toEqual(['p1'])
    const stillPending = withoutIds(work, workIds(landed))
    expect(stillPending.pilots).toEqual([{ id: 'p2' }, { noId: true }])
  })

  test('a server that does not name stranded rows leaves every row unconfirmed', async () => {
    const work = { ...EMPTY, pilots: [{ id: 'p1' }, { id: 'p2' }] }
    const legacy = async () => ({
      claimed: 1,
      skipped: 1,
      alreadyPresent: 0,
      declined: 0,
      byKind: {},
    })
    const { strandedIds } = await reconcile(legacy as never, work, { adopt: false })

    // Reading a missing field as "nothing stranded" would mark p2 as saved.
    expect(new Set(strandedIds)).toEqual(new Set(['p1', 'p2']))
    expect(countWork(withoutIds(work, new Set(strandedIds)))).toBe(0)
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

describe('combineBundles', () => {
  const bundle = (id: string): ExportBundle =>
    ({
      schemaVersion: 2,
      exportedAt: '2026-09-25T00:00:00.000Z',
      entities: { pilots: [{ id }], mechs: [], crawlers: [] },
      workspaces: [],
      softLinks: [],
      mechPatterns: [],
      encounterNpcs: [],
    }) as unknown as ExportBundle

  test('one download carries both the session and the device', () => {
    const combined = combineBundles(bundle('session'), bundle('device'))
    expect(combined?.entities.pilots.map((p) => p.id)).toEqual(['session', 'device'])
  })

  test('either side alone passes through, and neither is null', () => {
    expect(combineBundles(bundle('s'), null)?.entities.pilots).toHaveLength(1)
    expect(combineBundles(null, bundle('d'))?.entities.pilots).toHaveLength(1)
    expect(combineBundles(null, null)).toBeNull()
  })
})
