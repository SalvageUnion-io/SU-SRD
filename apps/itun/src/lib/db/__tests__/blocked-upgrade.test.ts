/**
 * Blocked-upgrade tests (production incident 2026-07-09).
 *
 * When the app is open in another tab on an older build, that tab holds a
 * connection at the previous DB version. A reload that needs to upgrade to
 * DB_VERSION is BLOCKED: IndexedDB leaves the open pending indefinitely, which
 * used to hang the Dashboard on its loading skeleton forever with no error.
 *
 * openItunDatabase now rejects with a typed BlockedUpgradeError after a short
 * grace window so the root error boundary can show a "close the other tab"
 * recovery screen. If the blocking connection closes inside the grace window,
 * the open proceeds normally.
 *
 * Isolation: a DEDICATED database name (never the shared app db), and every
 * blocking connection is opened via RAW indexedDB (no `versionchange` auto-close
 * handler) so it genuinely blocks the way a real second tab does.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { BlockedUpgradeError, DB_VERSION, openItunDatabase } from '../index'
import { STORE_NAMES } from '../stores'

const TEST_DB_NAME = 'itun-blocked-upgrade-test'

/** Delete the dedicated test database (never blocks — no other file opens it). */
async function destroyTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(TEST_DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('deleteDatabase blocked — a connection is still open'))
  })
}

/**
 * Open a raw connection at `version` and KEEP it open. Deliberately installs no
 * `onversionchange` handler, so it does not step aside for an upgrade — exactly
 * how a stale second tab blocks the new one.
 */
function openBlockingConnection(version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TEST_DB_NAME, version)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const storeName of Object.values(STORE_NAMES)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

describe('blocked IndexedDB upgrade', () => {
  beforeEach(destroyTestDatabase)
  afterEach(destroyTestDatabase)

  test('rejects with BlockedUpgradeError when another connection holds the old version open', async () => {
    const blocker = await openBlockingConnection(DB_VERSION - 1)

    // Silence the intentional "[itun-db] Upgrade blocked…" warning.
    const originalWarn = console.warn
    console.warn = () => {}
    try {
      await expect(openItunDatabase(TEST_DB_NAME, undefined, 20)).rejects.toBeInstanceOf(
        BlockedUpgradeError
      )
    } finally {
      console.warn = originalWarn
      // Release the blocker; the now-unblocked orphan open resolves and the
      // opener closes it (settled === true), so cleanup does not hit onblocked.
      blocker.close()
      await tick(60)
    }
  })

  test('resolves normally when the blocking connection closes within the grace window', async () => {
    const blocker = await openBlockingConnection(DB_VERSION - 1)

    const originalWarn = console.warn
    console.warn = () => {}
    try {
      // Grace comfortably exceeds the delay before the blocker steps aside.
      const pending = openItunDatabase(TEST_DB_NAME, undefined, 500)
      await tick(20)
      blocker.close()
      const db = await pending
      try {
        expect(db.version).toBe(DB_VERSION)
      } finally {
        db.close()
      }
    } finally {
      console.warn = originalWarn
    }
  })

  test('a fresh (unblocked) open still resolves at DB_VERSION', async () => {
    const db = await openItunDatabase(TEST_DB_NAME, undefined, 20)
    try {
      expect(db.version).toBe(DB_VERSION)
    } finally {
      db.close()
    }
  })
})
