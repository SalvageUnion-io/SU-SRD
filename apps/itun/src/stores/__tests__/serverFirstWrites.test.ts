/**
 * Server-first writes (ADR-034 decision 2, plan phase P4b).
 *
 * A write goes to Convex **before** anything local is touched, so a record the
 * server refused leaves no trace on the device.
 *
 * These tests run signed in against the test client
 * (`apps/itun/test/convexClientStub.ts`), which accepts every commit. That is
 * deliberate and is worth being explicit about: what is asserted here is the
 * **ordering contract** — that a record is built, committed and only then
 * placed in the store. The refusal path itself is exercised against a real server in
 * `test/convex/*`, which is where a mutation can actually refuse.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { useEntityStore } from '../entityStore'
import { prepareCreate, RECORD_KINDS } from '../records'
import { resetStores } from './resetStores'
import { withSignedInBackend } from './signedInBackend'

// These write, and only the signed-in backend writes. See signedInBackend.ts.
withSignedInBackend()

beforeEach(() => {
  resetStores()
})

afterEach(() => {
  resetStores()
})

describe('a record is built before it is stored', () => {
  test('prepareCreate mints an id and timestamps without writing', () => {
    const built = prepareCreate(RECORD_KINDS.pilot, {
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    expect(built.id).toBeTruthy()
    expect(built.createdAt).toBeTruthy()

    // The whole point of the split: nothing reached the store. Without this,
    // the id and timestamps only came into existence as a side effect of
    // storing, so there was no record to offer the server before committing.
    expect(useEntityStore.getState().get('pilot', built.id)).toBeNull()
  })

  test('create still stores — the split did not lose the write', async () => {
    const created = await useEntityStore.getState().create('pilot', {
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    expect(useEntityStore.getState().get('pilot', created.id)).not.toBeNull()
    expect(useEntityStore.getState().list('pilot')).toHaveLength(1)
  })
})

describe('update keeps its contract through the reorder', () => {
  test('the patch lands in the store', async () => {
    const store = useEntityStore.getState()
    const created = await store.create('pilot', {
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    const updated = await store.update('pilot', created.id, { callsign: 'Renamed' } as never, {
      kind: 'manual',
      source: 'test',
    })

    expect(updated.callsign).toBe('Renamed')
    expect(useEntityStore.getState().get('pilot', created.id)?.callsign).toBe('Renamed')
  })

  test('a rejected patch changes nothing', async () => {
    const store = useEntityStore.getState()
    const created = await store.create('pilot', {
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    // `prepareUpdate` strict-parses before anything is written, so a patch the
    // schema refuses aborts with the record untouched. Same guarantee the
    // server refusal now gets, arriving one step earlier.
    await expect(
      store.update('pilot', created.id, { callsign: 42 } as never, {
        kind: 'manual',
        source: 'test',
      })
    ).rejects.toThrow()

    expect(useEntityStore.getState().get('pilot', created.id)?.callsign).toBe(created.callsign)
  })
})
