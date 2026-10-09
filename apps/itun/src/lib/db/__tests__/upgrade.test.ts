/**
 * Opening the database, and reading what an older build left in it.
 *
 * An upgrade never rewrites a record: the database is a cache of Convex, so an
 * older version's stores are dropped and the current set is created empty, and
 * `ShelfSync` refills them on the next signed-in load (`../index.ts`).
 *
 * Isolation: the upgrade tests run against a DEDICATED database name. The shared
 * app database stays untouched — deleting it here would block on connections
 * other test files leave open (deleteDatabase blocks while any connection is
 * alive), wedging the whole suite.
 *
 * Strict read-path tests live here too; they use the shared db accessors
 * (no version games, no deletes — safe to share).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { openDB } from 'idb'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import { CACHE_META_ID } from '../cacheMeta'
import { clearCache, DB_VERSION, openItunDatabase, pilots } from '../index'
import { STORE_NAMES } from '../stores'

const TEST_DB_NAME = 'itun-upgrade-test'

/** Delete the dedicated test database (no other file opens it — never blocks). */
async function destroyTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(TEST_DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('deleteDatabase blocked — a connection is still open'))
  })
}

const stalePilot = {
  id: 'pilot-stale-1',
  schemaVersion: 1,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: ['a-1', 'a-2', 'a-3'],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
  currentHP: 10,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
}

/**
 * An older build's database: every current store plus the two it no longer
 * has (`workspaces`, the device-only `changeLog`), each holding a row, and a
 * meta row naming the account the rows belonged to.
 */
async function seedOlderDatabase(version: number): Promise<void> {
  const db = await openDB(TEST_DB_NAME, version, {
    upgrade(db) {
      for (const name of [...Object.values(STORE_NAMES), 'workspaces']) {
        db.createObjectStore(name, { keyPath: 'id' })
      }
      db.createObjectStore('changeLog', { keyPath: 'seq', autoIncrement: true })
    },
  })
  await db.put(STORE_NAMES.pilots, stalePilot)
  await db.put(STORE_NAMES.meta, { id: CACHE_META_ID, userId: 'user-a' })
  await db.put('workspaces', { id: 'default-workspace', name: 'Default workspace' })
  await db.put('changeLog', { entityId: stalePilot.id })
  db.close()
}

describe('opening the database', () => {
  beforeEach(async () => {
    await destroyTestDatabase()
  })

  afterEach(async () => {
    await destroyTestDatabase()
  })

  test('a fresh database opens directly at DB_VERSION with all stores', async () => {
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)
      expect([...db.objectStoreNames].sort()).toEqual(Object.values(STORE_NAMES).sort())
    } finally {
      db.close()
    }
  })

  test('an upgrade empties the cache: every row and the owner go', async () => {
    await seedOlderDatabase(DB_VERSION - 1)
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(db.version).toBe(DB_VERSION)
      for (const name of Object.values(STORE_NAMES)) {
        expect(await db.count(name)).toBe(0)
      }
    } finally {
      db.close()
    }
  })

  test('an upgrade drops the stores this version no longer has', async () => {
    await seedOlderDatabase(1)
    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect([...db.objectStoreNames].sort()).toEqual(Object.values(STORE_NAMES).sort())
    } finally {
      db.close()
    }
  })

  test('a same-version reopen keeps what the cache holds', async () => {
    const first = await openItunDatabase(TEST_DB_NAME)
    await first.put(STORE_NAMES.pilots, stalePilot)
    first.close()

    const db = await openItunDatabase(TEST_DB_NAME)
    try {
      expect(await db.count(STORE_NAMES.pilots)).toBe(1)
    } finally {
      db.close()
    }
  })
})

// ---------------------------------------------------------------------------
// Strict read path — uses the SHARED db (no deletes, no version games).
// ---------------------------------------------------------------------------

describe('strict read path', () => {
  beforeEach(async () => {
    await clearCache()
  })

  afterEach(async () => {
    await clearCache()
  })

  test('a record with an unknown field is skipped with a console warning, not a brick', async () => {
    // getDb is module-private — raw writes use a second connection to the
    // same shared app database via the canonical opener.
    const db = await openItunDatabase()
    await db.put(STORE_NAMES.pilots, {
      ...stalePilot,
      id: 'pilot-drifted',
      fieldFromTheFuture: 'whatever',
    })
    db.close()

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      expect(await pilots.get('pilot-drifted')).toBeNull()
      expect((await pilots.list()).some((p) => p.id === 'pilot-drifted')).toBe(false)
      expect(warnings.some((w) => w.includes('Skipping unreadable record'))).toBe(true)
    } finally {
      console.warn = originalWarn
    }
  })

  test('an unreadable record is skipped (with a warning) instead of failing the whole list', async () => {
    const db = await openItunDatabase()
    await pilots.create({
      schemaVersion: 1,
      name: 'Good Pilot',
      callsign: 'OK',
      classRef: 'scavenger',
      abilities: [],
      equipment: [],
      motto: '',
      keepsake: '',
      appearance: '',
      background: '',
      conditions: [],
    })
    // Required fields missing entirely.
    await db.put(STORE_NAMES.pilots, { id: 'pilot-garbage', createdAt: FIXTURE_NOW })
    db.close()

    const originalWarn = console.warn
    console.warn = () => {}
    try {
      const all = await pilots.list()
      expect(all.some((p) => p.name === 'Good Pilot')).toBe(true)
      expect(all.some((p) => p.id === 'pilot-garbage')).toBe(false)
    } finally {
      console.warn = originalWarn
    }
  })

  test('updating a record that does not parse throws and leaves it untouched', async () => {
    const db = await openItunDatabase()
    try {
      await db.put(STORE_NAMES.pilots, {
        ...stalePilot,
        id: 'pilot-unreadable',
        fieldFromTheFuture: true,
      })

      const originalWarn = console.warn
      console.warn = () => {}
      try {
        await expect(pilots.update('pilot-unreadable', { motto: 'Edited.' })).rejects.toThrow(
          'does not parse'
        )
      } finally {
        console.warn = originalWarn
      }

      const raw = await db.get(STORE_NAMES.pilots, 'pilot-unreadable')
      expect((raw as Record<string, unknown>).motto).toBe('')
    } finally {
      db.close()
    }
  })
})
