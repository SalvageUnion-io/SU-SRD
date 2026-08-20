/**
 * `transfer()` commits its DELETES to the server, not just its updates.
 *
 * Phase 1b already committed every update before touching disk, and its comment
 * states the guarantee plainly — "a refusal aborts with nothing changed
 * locally". That only ever held for the updates. The `deletes` array went
 * straight into the phase-2 IndexedDB transaction with no commit at all, so a
 * transfer that consumed a stack of cargo deleted it locally and left it alive
 * on the server. `ShelfSync` then restored it on the next sync.
 *
 * The end state is worse than a half-applied transfer: it is BOTH ends. The
 * value arrives at the target and the source keeps it too.
 *
 * These tests spy on the backend rather than running against a real server,
 * because with no Convex configured `selectBackend()` is `local` and the commit
 * is a no-op — the same reason `serverFirstWrites.test.ts` gives. What is
 * asserted is that the delete reaches the commit seam at all, which is exactly
 * what was missing.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { _clearAllStores, _resetDbSingleton } from '../../lib/db/index'

// The namespace is captured with a SPREAD, before any mocking. A module
// namespace is a live view, so holding the object itself would read as the mock
// by the time `afterAll` restored it — this repo has been bitten by that.
const realBackend = { ...(await import('../entityBackend')) }

type EntityCommit = { kind: string; appId: string }
const entityCommits: EntityCommit[] = []
const softLinkCommits: string[] = []

// Every export is re-provided, not only the two under test. A partial mock
// breaks importers nobody was thinking about — `requireWritableBackend` and
// `WritesBlockedOffline` are both reached from `entityStore` on this path.
mock.module('../entityBackend', () => ({
  ...realBackend,
  commitEntityWrite: async (_type: string, write: EntityCommit) => {
    entityCommits.push(write)
  },
  commitSoftLink: async (kind: string) => {
    softLinkCommits.push(kind)
  },
}))

afterAll(() => {
  mock.module('../entityBackend', () => realBackend)
})

const { useEntityStore } = await import('../entityStore')
const { LIVE_SHEET_MANUAL } = await import('../surfaceProvenance')

beforeEach(async () => {
  _resetDbSingleton()
  await _clearAllStores()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  entityCommits.length = 0
  softLinkCommits.length = 0
})

async function seedMech(name: string) {
  return await useEntityStore.getState().create('mech', {
    schemaVersion: 1 as const,
    name,
    chassisRef: 'mule',
    systems: [],
    modules: [],
    cargoLots: [],
    conditions: [],
  })
}

describe('transfer() commits deletes', () => {
  test('a deleted entity reaches the commit seam', async () => {
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')
    entityCommits.length = 0

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
        deletes: [{ type: 'mech', id: doomed.id }],
      },
      LIVE_SHEET_MANUAL
    )

    const deletes = entityCommits.filter((c) => c.kind === 'delete')
    expect(deletes).toHaveLength(1)
    expect(deletes[0]?.appId).toBe(doomed.id)
  })

  test('the update is still committed alongside it', async () => {
    // Guards against a fix that swapped one loop for the other rather than
    // adding to it.
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')
    entityCommits.length = 0

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
        deletes: [{ type: 'mech', id: doomed.id }],
      },
      LIVE_SHEET_MANUAL
    )

    expect(entityCommits.some((c) => c.kind === 'delete')).toBe(true)
    expect(entityCommits.some((c) => c.kind !== 'delete')).toBe(true)
  })

  test('the row is still gone locally', async () => {
    // The fix must not have traded a server write for a local one.
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
        deletes: [{ type: 'mech', id: doomed.id }],
      },
      LIVE_SHEET_MANUAL
    )

    expect(useEntityStore.getState().get('mech', doomed.id)).toBeNull()
  })

  test('a transfer with no deletes commits none', async () => {
    // Control: the new loop must be driven by the deletes array, not fire
    // unconditionally.
    const keeper = await seedMech('Keeper')
    entityCommits.length = 0

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Renamed' } }],
        deletes: [],
      },
      LIVE_SHEET_MANUAL
    )

    expect(entityCommits.filter((c) => c.kind === 'delete')).toHaveLength(0)
  })
})
