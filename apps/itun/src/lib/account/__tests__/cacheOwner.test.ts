/**
 * The cache belongs to one account at a time (`cacheOwner.ts`), driven here
 * through the real database rather than asserted on a stand-in.
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
import { claimCacheFor, forgetCache } from '../cacheOwner'

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
  test("an account's cache is emptied and handed to nobody", async () => {
    await writeCacheMeta({ userId: 'user-a' })
    expect(useEntityStore.getState().pilots.map((p) => p.id)).toEqual(['p1'])

    await forgetCache()

    expect(await dbPilots.list()).toEqual([])
    expect(await readCacheMeta()).toEqual({ userId: null })
    expect(useEntityStore.getState().pilots).toEqual([])
  })
})

describe('claimCacheFor', () => {
  test("the same account's cache is kept", async () => {
    await writeCacheMeta({ userId: 'user-a' })

    await claimCacheFor('user-a')

    expect((await dbPilots.list()).map((p) => p.id)).toEqual(['p1'])
    expect(await readCacheMeta()).toEqual({ userId: 'user-a' })
  })

  test("another account's cache is emptied and handed over", async () => {
    await writeCacheMeta({ userId: 'user-a' })

    await claimCacheFor('user-b')

    expect(await dbPilots.list()).toEqual([])
    expect(await readCacheMeta()).toEqual({ userId: 'user-b' })
    expect(useEntityStore.getState().pilots).toEqual([])
  })

  test("a cache that is nobody's is emptied and handed over", async () => {
    await writeCacheMeta({ userId: null })

    await claimCacheFor('user-a')

    expect(await dbPilots.list()).toEqual([])
    expect(await readCacheMeta()).toEqual({ userId: 'user-a' })
  })
})
