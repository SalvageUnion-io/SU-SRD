/**
 * An op the server refused as stale leaves the sheet showing the server's
 * version, and tells the player to make the change again.
 *
 * `ops.apply` refuses an op whose fields changed after its `baseSeq`
 * (`test/convex/__tests__/ops.test.ts` pins that half). This is the client half: the refusal carries the server's row, the store adopts it,
 * and the write still fails — with copy a player can act on rather than "That
 * change could not be saved."
 */

import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { staleWriteError } from '../../../convex/model/staleWrite'
import { pilotFixture } from '../../components/__tests__/fixtures'
import { withSignedInBackend } from './signedInBackend'

withSignedInBackend()

// Captured with a SPREAD before mocking: a module namespace is a live view.
const realOutbox = { ...(await import('../outbox')) }

/** The row the server holds; every pilot write is refused as stale against it. */
const serverRow = {
  updatedAt: 9,
  headSeq: 4,
  body: pilotFixture({ id: 'p1', name: 'Saved elsewhere' }),
}

mock.module('../outbox', () => ({
  ...realOutbox,
  sendOp: async () => {
    throw staleWriteError(serverRow)
  },
}))

afterAll(() => {
  mock.module('../outbox', () => realOutbox)
})

const { useUnits } = await import('../units')
const { headSeqOf, versionOf } = await import('../replica')
const { StaleWriteRefused } = await import('../sync')
const { resetStores } = await import('./resetStores')

beforeEach(() => {
  resetStores()
  useUnits.setState({
    hydrated: { pilots: true, mechs: true, crawlers: true, npcs: true, softLinks: true },
  })
})

describe('a stale write', () => {
  test('is refused with re-apply copy, and the sheet shows the server version', async () => {
    const store = useUnits.getState()
    await store.adopt('pilot', pilotFixture({ id: 'p1', name: 'Old copy' }))

    await expect(
      store.update('pilot', 'p1', { name: 'My edit' }, { kind: 'manual', source: 'test' })
    ).rejects.toBeInstanceOf(StaleWriteRefused)

    expect(useUnits.getState().get('pilot', 'p1')?.name).toBe('Saved elsewhere')
    // The next write is made against the version just adopted, so it lands.
    expect(versionOf('pilot', 'p1')).toBe(9)
    expect(headSeqOf('pilot', 'p1')).toBe(4)
  })
})
