/**
 * The v18 meta row: whether this browser's rows predate accounts, and whose
 * they are (`cacheMeta.ts`).
 *
 * `legacy` is the answer that holds back the prune and every wipe, so it must
 * be given to exactly the browsers that may hold rows no account has — a
 * database from before v18 with a roster in it — and to nobody else. A cache
 * that `ShelfSync` filled is the case this replaced a row count for: it is full
 * of rows, and every one is already in the account.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { deleteDB, openDB } from 'idb'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { CACHE_META_ID, parseCacheMeta, writeInitialCacheMeta } from '../cacheMeta'
import { DB_VERSION, openItunDatabase } from '../index'
import type { UpgradeTransaction } from '../migrations/types'
import { STORE_NAMES } from '../stores'

type Row = Record<string, unknown>

/** A stand-in for the versionchange transaction: `count` and `put` over arrays. */
function fakeTx(stores: Record<string, Row[]>): UpgradeTransaction {
  return {
    objectStore(name: string) {
      const rows = stores[name] ?? []
      stores[name] = rows
      return {
        async count() {
          return rows.length
        },
        async put(row: Row) {
          rows.push(row)
        },
      }
    },
  } as unknown as UpgradeTransaction
}

describe('the first meta row', () => {
  test('a pre-v18 database holding a roster is legacy', async () => {
    const stores: Record<string, Row[]> = { pilots: [{ id: 'p1' }] }
    await writeInitialCacheMeta(fakeTx(stores), 17)
    expect(stores.meta).toEqual([{ id: CACHE_META_ID, origin: 'legacy', userId: null }])
  })

  test('a pre-v18 database holding only a tray or a pattern is legacy too', async () => {
    const stores: Record<string, Row[]> = { encounterNpcs: [{ id: 'n1' }] }
    await writeInitialCacheMeta(fakeTx(stores), 9)
    expect(stores.meta?.[0]?.origin).toBe('legacy')
  })

  test('links and history alone are not a roster', async () => {
    const stores: Record<string, Row[]> = { softLinks: [{ id: 'l1' }], changeLog: [{ seq: 1 }] }
    await writeInitialCacheMeta(fakeTx(stores), 17)
    expect(stores.meta?.[0]?.origin).toBe('cache')
  })

  test('a fresh database is a cache, whatever it is about to hold', async () => {
    const stores: Record<string, Row[]> = { pilots: [{ id: 'p1' }] }
    await writeInitialCacheMeta(fakeTx(stores), 0)
    expect(stores.meta?.[0]?.origin).toBe('cache')
  })
})

describe('reading it back', () => {
  test('a missing row is a cache that belongs to nobody', () => {
    expect(parseCacheMeta(undefined)).toEqual({ origin: 'cache', userId: null })
  })

  test('only an explicit legacy origin is legacy', () => {
    expect(parseCacheMeta({ origin: 'legacy', userId: 'u1' })).toEqual({
      origin: 'legacy',
      userId: 'u1',
    })
    expect(parseCacheMeta({ origin: 'something-else', userId: 7 })).toEqual({
      origin: 'cache',
      userId: null,
    })
  })
})

describe('the real upgrade', () => {
  const NAME = 'itun-cache-meta-upgrade-test'

  afterEach(async () => {
    await deleteDB(NAME)
  })

  /** A v17 database with every store a v17 build created, and one pilot. */
  async function seedV17(withPilot: boolean): Promise<void> {
    const db = await openDB(NAME, 17, {
      upgrade(db) {
        for (const name of Object.values(STORE_NAMES)) {
          if (name === STORE_NAMES.meta) continue
          db.createObjectStore(name, { keyPath: 'id' })
        }
        // The device-only Change Log every build from v9 to v17 created.
        db.createObjectStore('changeLog', { keyPath: 'seq', autoIncrement: true })
      },
    })
    if (withPilot) await db.put(STORE_NAMES.pilots, pilotFixture({ id: 'legacy-1' }))
    db.close()
  }

  test('opening a v17 roster at v18 records it as legacy', async () => {
    await seedV17(true)
    const db = await openItunDatabase(NAME)
    try {
      expect(db.version).toBe(DB_VERSION)
      expect(parseCacheMeta(await db.get(STORE_NAMES.meta, CACHE_META_ID))).toEqual({
        origin: 'legacy',
        userId: null,
      })
    } finally {
      db.close()
    }
  })

  test('opening a v17 database at v18 drops the device-only Change Log', async () => {
    await seedV17(true)
    const db = await openItunDatabase(NAME)
    try {
      expect(db.objectStoreNames.contains('changeLog')).toBe(false)
    } finally {
      db.close()
    }
  })

  test('opening an empty v17 database at v18 records a cache', async () => {
    await seedV17(false)
    const db = await openItunDatabase(NAME)
    try {
      expect(parseCacheMeta(await db.get(STORE_NAMES.meta, CACHE_META_ID)).origin).toBe('cache')
    } finally {
      db.close()
    }
  })
})
