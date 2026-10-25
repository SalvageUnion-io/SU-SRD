/**
 * `transfer()` commits the whole transfer — its updates AND its deletes — to the
 * server as ONE mutation (`ops.transfer`), before anything local is
 * written.
 *
 * A delete that skipped the server deleted the record locally and left it
 * alive there, and the next sync served it back: the value arrived
 * at the target and the source kept it too. One mutation is also what makes
 * the server side all-or-nothing (`test/convex/__tests__/transfer.test.ts`).
 *
 * These spy on the commit seam rather than running against a server: the
 * test client (`apps/web/test/convexClientStub.ts`) accepts every write.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { FIXTURE_NOW } from '../../components/__tests__/fixtures'
import type { TransferRemoval, TransferWrite } from '../outbox'
import { withSignedInBackend } from './signedInBackend'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// The namespace is captured with a SPREAD, before any mocking. A module
// namespace is a live view, so holding the object itself would read as the mock
// by the time `afterAll` restored it.
const realOutbox = { ...(await import('../outbox')) }

const transfers: { writes: readonly TransferWrite[]; removals: readonly TransferRemoval[] }[] = []
let refuse = false

// Every export is re-provided, not only the one under test: a partial mock
// breaks importers nobody was thinking about.
mock.module('../outbox', () => ({
  ...realOutbox,
  sendRow: async () => undefined,
  sendTransfer: async (writes: readonly TransferWrite[], removals: readonly TransferRemoval[]) => {
    transfers.push({ writes, removals })
    if (refuse) throw new Error('refused')
    return new Map()
  },
}))

afterAll(() => {
  mock.module('../outbox', () => realOutbox)
})

const { useUnits } = await import('../units')
const { resetStores } = await import('./resetStores')
const { LIVE_SHEET_MANUAL } = await import('../provenance')

beforeEach(() => {
  resetStores()
  transfers.length = 0
  refuse = false
})

async function seedMech(name: string) {
  return await useUnits.getState().create('mech', {
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

    await useUnits.getState().transfer(
      {
        updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
        deletes: [{ type: 'mech', id: doomed.id }],
      },
      LIVE_SHEET_MANUAL
    )

    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.writes.map((w) => w.op.unitId)).toEqual([keeper.id])
    // The op names only what moved, made against the copy this tab holds.
    expect(transfers[0]?.writes[0]?.op).toMatchObject({
      patch: { name: 'Keeper Renamed' },
      kind: LIVE_SHEET_MANUAL.kind,
      source: LIVE_SHEET_MANUAL.source,
    })
    expect(transfers[0]?.removals).toEqual([{ type: 'mech', id: doomed.id }])
    expect(useUnits.getState().get('mech', doomed.id)).toBeNull()
  })

  test('a refused commit changes nothing here', async () => {
    const doomed = await seedMech('Doomed')
    const keeper = await seedMech('Keeper')
    refuse = true

    await expect(
      useUnits.getState().transfer(
        {
          updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }],
          deletes: [{ type: 'mech', id: doomed.id }],
        },
        LIVE_SHEET_MANUAL
      )
    ).rejects.toThrow('refused')

    expect(useUnits.getState().get('mech', doomed.id)).not.toBeNull()
    expect(useUnits.getState().get('mech', keeper.id)?.name).toBe('Keeper')
  })
})

describe('transferArgs', () => {
  test('each op as ops.apply takes it, each link by its endpoints', () => {
    const op = {
      id: 'op-1',
      unitId: 'c1',
      baseSeq: 3,
      at: 1,
      kind: 'manual' as const,
      source: 'test',
      patch: {},
      unset: ['maxSpOverride'],
    }
    const args = realOutbox.transferArgs(
      [{ unit: 'crawler', gameId: null, op, move: null }],
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

    expect(args.ops).toEqual([{ unit: 'crawler', gameId: null, op, move: null }])
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
})
