/**
 * `transfer()` commits the whole transfer to its room as ONE send
 * (`sendTransfer`), before anything local is written: one batch is what makes
 * the room's side all-or-nothing.
 *
 * These spy on the commit seam rather than running against a room.
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { TransferWrite } from '../outbox'
import { withSignedInBackend } from './signedInBackend'

// Building and editing need an account (ADR-034 as amended), so these writes run signed in.
withSignedInBackend()

// The namespace is captured with a SPREAD, before any mocking. A module
// namespace is a live view, so holding the object itself would read as the mock
// by the time `afterAll` restored it.
const realOutbox = { ...(await import('../outbox')) }

const transfers: (readonly TransferWrite[])[] = []
let refuse = false

// Every export is re-provided, not only the one under test: a partial mock
// breaks importers nobody was thinking about.
mock.module('../outbox', () => ({
  ...realOutbox,
  sendRow: async () => undefined,
  sendTransfer: async (writes: readonly TransferWrite[]) => {
    transfers.push(writes)
    if (refuse) throw new Error('refused')
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
  test('both updates reach the room in one commit', async () => {
    const giver = await seedMech('Giver')
    const keeper = await seedMech('Keeper')

    await useUnits.getState().transfer(
      {
        updates: [
          { type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } },
          { type: 'mech', id: giver.id, patch: { name: 'Giver Renamed' } },
        ],
      },
      LIVE_SHEET_MANUAL
    )

    expect(transfers).toHaveLength(1)
    expect(transfers[0]?.map((w) => w.op.unitId)).toEqual([keeper.id, giver.id])
    // The op names only what moved, made against the copy this tab holds.
    expect(transfers[0]?.[0]?.op).toMatchObject({
      patch: { name: 'Keeper Renamed' },
      kind: LIVE_SHEET_MANUAL.kind,
      source: LIVE_SHEET_MANUAL.source,
    })
  })

  test('a refused commit changes nothing here', async () => {
    const keeper = await seedMech('Keeper')
    refuse = true

    await expect(
      useUnits
        .getState()
        .transfer(
          { updates: [{ type: 'mech', id: keeper.id, patch: { name: 'Keeper Renamed' } }] },
          LIVE_SHEET_MANUAL
        )
    ).rejects.toThrow('refused')

    expect(useUnits.getState().get('mech', keeper.id)?.name).toBe('Keeper')
  })
})
