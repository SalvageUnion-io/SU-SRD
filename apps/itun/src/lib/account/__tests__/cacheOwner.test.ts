/**
 * Sign-out forgets the cache, except a pre-account roster (`cacheOwner.ts`).
 *
 * The `legacy` guard is the only thing standing between sign-out and the one
 * copy of rows that may be in no account yet, so it is driven here through the
 * real database rather than asserted on a stand-in.
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { withSignedInBackend } from '../../../stores/__tests__/signedInBackend'
import { useEntityStore } from '../../../stores/entityStore'
import {
  _resetDbSingleton,
  clearCache,
  pilots as dbPilots,
  readCacheMeta,
  writeCacheMeta,
} from '../../db/index'
import { forgetCache } from '../cacheOwner'

// The emptied cache is read back through the store, and only the signed-in
// backend reads IndexedDB at all (`signedInBackend.ts`).
withSignedInBackend()

beforeEach(async () => {
  _resetDbSingleton()
  await clearCache()
  await dbPilots.put(pilotFixture({ id: 'p1' }))
  await useEntityStore.getState().rehydrate('pilot')
})

describe('forgetCache', () => {
  test('a legacy roster keeps its rows and its meta row', async () => {
    await writeCacheMeta({ origin: 'legacy', userId: null })

    await forgetCache()

    expect((await dbPilots.list()).map((p) => p.id)).toEqual(['p1'])
    expect(await readCacheMeta()).toEqual({ origin: 'legacy', userId: null })
    expect(useEntityStore.getState().pilots.map((p) => p.id)).toEqual(['p1'])
  })

  test("an account's cache is emptied and handed to nobody", async () => {
    await writeCacheMeta({ origin: 'cache', userId: 'user-a' })
    expect(useEntityStore.getState().pilots.map((p) => p.id)).toEqual(['p1'])

    await forgetCache()

    expect(await dbPilots.list()).toEqual([])
    expect(await readCacheMeta()).toEqual({ origin: 'cache', userId: null })
    expect(useEntityStore.getState().pilots).toEqual([])
  })
})
