/**
 * A pilot or mech write the server refused as stale leaves the sheet showing
 * the server's version, and tells the player to make the change again.
 *
 * `entities.upsertByAppId` refuses a whole-body write made against a version
 * the row has moved past (`test/convex/appId.test.ts` pins that half). This is
 * the client half: the refusal carries the server's row, the store adopts it,
 * and the write still fails — with copy a player can act on rather than "That
 * change could not be saved."
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { staleWriteError } from '../../lib/connection/staleWrite'
import { _resetDbSingleton, clearCache } from '../../lib/db/index'
import { withSignedInBackend } from './signedInBackend'

withSignedInBackend()

// Captured with a SPREAD before mocking: a module namespace is a live view.
const realBackend = { ...(await import('../entityBackend')) }

/** The row the server holds; every pilot write is refused as stale against it. */
const serverRow = { updatedAt: 9, body: pilotFixture({ id: 'p1', name: 'Saved elsewhere' }) }

mock.module('../entityBackend', () => ({
  ...realBackend,
  commitEntityWrite: async () => {
    throw staleWriteError(serverRow)
  },
}))

afterAll(() => {
  mock.module('../entityBackend', () => realBackend)
})

const { useEntityStore } = await import('../entityStore')
const { knownVersion, forgetVersions } = await import('../serverVersions')

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  forgetVersions()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
})

describe('a stale write', () => {
  test('is refused with re-apply copy, and the sheet shows the server version', async () => {
    const store = useEntityStore.getState()
    await store.adopt('pilot', pilotFixture({ id: 'p1', name: 'Old copy' }))

    await expect(
      store.update('pilot', 'p1', { name: 'My edit' }, { kind: 'manual', source: 'test' })
    ).rejects.toBeInstanceOf(realBackend.StaleWriteRefused)

    expect(useEntityStore.getState().get('pilot', 'p1')?.name).toBe('Saved elsewhere')
    // The next write is made against the version just adopted, so it lands.
    expect(knownVersion('p1')).toBe(9)
  })
})
