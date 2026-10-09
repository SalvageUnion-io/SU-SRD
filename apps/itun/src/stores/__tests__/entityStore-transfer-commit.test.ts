/**
 * `transfer()` commits the whole transfer — its updates AND its deletes — to the
 * server as ONE mutation (`entities.transfer`), before anything local is
 * written.
 *
 * A delete that skipped the server deleted the record locally and left it
 * alive there, and `ShelfSync` restored it on the next sync: the value arrived
 * at the target and the source kept it too. One mutation is also what makes
 * the server side all-or-nothing (`test/convex/transfer.test.ts`).
 *
 * These spy on the commit seam rather than running against a server: the
 * test client (`apps/itun/test/convexClientStub.ts`) accepts every write.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { FIXTURE_NOW } from '../../components/__tests__/fixtures'
import { _resetDbSingleton, clearCache } from '../../lib/db/index'
import type { TransferRemoval, TransferWrite } from '../entityBackend'
import { withSignedInBackend } from './signedInBackend'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// The namespace is captured with a SPREAD, before any mocking. A module
// namespace is a live view, so holding the object itself would read as the mock
// by the time `afterAll` restored it.
const realBackend = { ...(await import('../entityBackend')) }

const transfers: { writes: readonly TransferWrite[]; removals: readonly TransferRemoval[] }[] = []
let refuse = false

// Every export is re-provided, not only the one under test: a partial mock
// breaks importers nobody was thinking about.
mock.module('../entityBackend', () => ({
  ...realBackend,
  commitEntityWrite: async () => {},
  commitTransfer: async (
    writes: readonly TransferWrite[],
    removals: readonly TransferRemoval[]
  ) => {
    transfers.push({ writes, removals })
    if (refuse) throw new Error('refused')
  },
}))

afterAll(() => {
  mock.module('../entityBackend', () => realBackend)
})

const { useEntityStore } = await import('../entityStore')
const { LIVE_SHEET_MANUAL } = await import('../surfaceProvenance')

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
  })
  transfers.length = 0
  refuse = false
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

describe('transfer() commits once', () => {
  test('the update and the delete reach the server in one commit', async () => {
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')

    await useEntityStore.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
        deletes: [{ type: 'mech', id: doomed.id }],
      },
      LIVE_SHEET_MANUAL
    )

    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.writes.map((w) => w.record.id)).toEqual([keeper.id])
    expect(transfers[0]?.removals).toEqual([{ type: 'mech', id: doomed.id }])
    expect(useEntityStore.getState().get('mech', doomed.id)).toBeNull()
  })

  test('a refused commit changes nothing here', async () => {
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')
    refuse = true

    await expect(
      useEntityStore.getState().transfer(
        {
          updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
          deletes: [{ type: 'mech', id: doomed.id }],
        },
        LIVE_SHEET_MANUAL
      )
    ).rejects.toThrow('refused')

    expect(useEntityStore.getState().get('mech', doomed.id)).not.toBeNull()
    expect(useEntityStore.getState().get('mech', keeper.id)?.name).toBe('Keeper')
  })
})

describe('transferArgs', () => {
  test('each record takes the shape its own mutation takes', () => {
    const args = realBackend.transferArgs(
      [
        { type: 'mech', record: { id: 'm1', gameId: null }, patch: { cargoLots: [] } },
        {
          type: 'crawler',
          record: { id: 'c1', gameId: null },
          patch: { maxSpOverride: undefined },
        },
      ],
      [
        { type: 'pilot', id: 'p1' },
        {
          type: 'softLink',
          link: {
            id: 'l1',
            type: 'mech-to-pilot',
            from: { type: 'mech', id: 'm1' },
            to: { type: 'pilot', id: 'p1' },
            createdAt: FIXTURE_NOW,
          },
        },
        // Half a link has nothing to address and is dropped.
        { type: 'softLink', link: null },
      ]
    )

    expect(args.updates[0]).toMatchObject({ table: 'mechs', appId: 'm1', gameId: null })
    // A cleared crawler field travels as `unset`; no `gameId` means no move.
    expect(args.updates[1]).toEqual({
      table: 'crawlers',
      appId: 'c1',
      patch: { maxSpOverride: undefined },
      unset: ['maxSpOverride'],
    })
    expect(args.deletes).toEqual([
      { table: 'pilots', appId: 'p1' },
      {
        table: 'softLinks',
        from: { type: 'mech', id: 'm1' },
        to: { type: 'pilot', id: 'p1' },
        type: 'mech-to-pilot',
      },
    ])
  })

  test('a crawler patch that changes container carries the move', () => {
    const args = realBackend.transferArgs(
      [{ type: 'crawler', record: { id: 'c1', gameId: null }, patch: { gameId: null } }],
      []
    )
    expect(args.updates[0]).toMatchObject({ table: 'crawlers', appId: 'c1', gameId: null })
  })
})
