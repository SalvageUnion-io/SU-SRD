/**
 * Server-first writes (ADR-034 decision 2, plan phase P4b).
 *
 * The demotion's last act: a write goes to Convex **before** anything local is
 * touched, so a record the server refused leaves no trace on the device. Its
 * predecessor did the opposite — wrote locally, then fired a mirror at the
 * server and swallowed the failure into a console warning — because back then
 * the local store was the source of truth and the UI read it.
 *
 * These tests run with no Convex configured, so `selectBackend()` is `local` and
 * the commit is a no-op. That is deliberate and is worth being explicit about:
 * what is asserted here is the **ordering contract** — that a record is built,
 * committed and only then persisted — and that the local path still behaves
 * exactly as it did. The refusal path itself is exercised against a real server
 * in `test/convex/*`, which is where a mutation can actually refuse.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import * as db from '../../lib/db/index'
import { useEntityStore } from '../entityStore'

afterEach(async () => {
  const store = useEntityStore.getState()
  for (const type of ['pilot', 'mech', 'crawler'] as const) {
    for (const row of store.list(type)) await store.forget(type, row.id)
  }
  await db._clearAllStores()
})

describe('a record is built before it is persisted', () => {
  test('prepareCreate mints an id and timestamps without writing', async () => {
    const built = await db.pilots.prepareCreate({
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    expect(built.id).toBeTruthy()
    expect(built.createdAt).toBeTruthy()

    // The whole point of the split: nothing reached disk. Without this, the id
    // and timestamps only came into existence as a side effect of persisting,
    // so there was no record to offer the server before committing to it.
    expect(await db.pilots.get(built.id)).toBeNull()
  })

  test('create still persists — the split did not lose the write', async () => {
    const created = await useEntityStore.getState().create('pilot', {
      ...pilotFixture({ id: 'ignored' }),
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    } as never)

    expect(await db.pilots.get(created.id)).not.toBeNull()
    expect(useEntityStore.getState().list('pilot')).toHaveLength(1)
  })
})

describe('update keeps its contract through the reorder', () => {
  test('the patch lands locally and in the cache', async () => {
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
    expect((await db.pilots.get(created.id))?.callsign).toBe('Renamed')
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

    expect((await db.pilots.get(created.id))?.callsign).toBe(created.callsign)
  })
})
