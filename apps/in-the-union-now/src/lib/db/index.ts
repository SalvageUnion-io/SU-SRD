/**
 * ADR: idb vs Dexie for IndexedDB access
 * =========================================
 * Decision: use `idb` (v8).
 *
 * Rationale:
 *   - idb is a thin (~3 KB) promise wrapper around the native IndexedDB API.
 *   - Dexie is ~30 KB and bundles a query DSL (where/orderBy/filter chains)
 *     that ITUN does not need — all access patterns are object-store CRUD
 *     by primary key.
 *   - Schema ownership: Zod schemas (not Dexie TableSchema) are the source
 *     of truth for entity shapes. Giving Dexie a separate schema definition
 *     would create duplication and a synchronization hazard.
 *   - Typing: idb's `IDBPDatabase` generic is structurally compatible with
 *     our store; Dexie's `Table<T>` inference requires a full class pattern.
 *
 * Migration strategy (plan 2.1):
 *   - Object-store creation lives in the `upgrade` callback below.
 *   - Record rewrites live in `migrations/<n>-<description>.ts`, registered
 *     in `migrations/index.ts` and run via runMigrations() with the
 *     versionchange transaction.
 *   - Reads additionally get a salvage path (see makeStore options): drifted
 *     records are stripped/defaulted with a console warning instead of
 *     bricking store hydration — the safety net for PWA autoUpdate version
 *     skew where new code may meet old data (or vice versa).
 */

import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'

import { CrawlerSchema } from '../schemas/crawler'
import { MechSchema } from '../schemas/mech'
import { MechPatternSchema } from '../schemas/pattern'
import { PilotSchema } from '../schemas/pilot'
import { SoftLinkSchema } from '../schemas/softLink'
import { WorkspaceSchema } from '../schemas/workspace'
import { makeStore } from './crud'
import { runMigrations } from './migrations/index'
import { STORE_NAMES } from './stores'

/** Current IndexedDB schema version. Bump together with a migrations/ entry. */
export const DB_VERSION = 3

export const DB_NAME = 'itun-v1'

/** Singleton promise — openDB is called once per page load. */
let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * The canonical opener: object-store creation + registered record-rewrite
 * migrations. Exported (with a name parameter) so the migration test suite
 * can exercise the full upgrade path against a dedicated throwaway database
 * without touching the app database other test files share.
 */
export function openItunDatabase(name: string = DB_NAME): Promise<IDBPDatabase> {
  return openDB(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      // v1: create all core object stores with keyPath = 'id'
      if (oldVersion < 1) {
        for (const storeName of [
          STORE_NAMES.pilots,
          STORE_NAMES.mechs,
          STORE_NAMES.crawlers,
          STORE_NAMES.workspaces,
          STORE_NAMES.softLinks,
        ]) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        }
      }
      // v2 (Wave 4, cycle-1): add mechPatterns object store.
      // See ADR in src/lib/schemas/pattern.ts.
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAMES.mechPatterns)) {
          db.createObjectStore(STORE_NAMES.mechPatterns, { keyPath: 'id' })
        }
      }
      // v3+: record rewrites live in migrations/ — one file per version.
      // runMigrations only awaits IDB operations on `transaction`, so the
      // versionchange transaction stays open until every rewrite lands.
      // On failure the transaction is aborted so the version bump never
      // commits over half-migrated data.
      void runMigrations(db, transaction, oldVersion).catch((err: unknown) => {
        console.error('[itun-db] Migration failed — aborting upgrade transaction.', err)
        transaction.abort()
      })
    },
  })
}

// Exported so the throwaway dev seed (scaffold/seed.ts) opens the DB through the
// canonical opener — which runs the `upgrade` that creates the object stores.
// (Opening bare with `openDB('itun-v1', 2)` on a fresh DB yields no stores.)
export function getDb(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    dbPromise = openItunDatabase()
  }
  return dbPromise
}

/**
 * Resets the DB singleton. Used in tests to force a new connection on next
 * operation. Call this before `_clearAllStores()` so the next getDb() opens
 * a fresh connection to the (now-empty) stores.
 * Test-only — not re-exported from the package public surface.
 */
export function _resetDbSingleton(): void {
  dbPromise = null
}

/**
 * Clears all object stores in the database. Used in tests to isolate state
 * between test cases without needing to delete and recreate the database.
 * Requires the DB to be open; call getDb() inside to ensure it is.
 * Test-only — not re-exported from the package public surface.
 */
export async function _clearAllStores(): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(Object.values(STORE_NAMES), 'readwrite')
  await Promise.all(Object.values(STORE_NAMES).map((name) => tx.objectStore(name).clear()))
  await tx.done
}

// Per-entity store accessors
// hasUpdatedAt=true for Pilot, Mech, Crawler (their schemas include updatedAt)
// hasUpdatedAt=false (default) for Workspace (createdAt only), SoftLink (createdAt only),
// and MechPattern (createdAt only — patterns are immutable after creation).
// salvageSchema = the same object shape with `.strip()` — reads tolerate
// drifted records (unknown fields stripped) instead of bricking hydration.

export const pilots = makeStore(getDb, PilotSchema, STORE_NAMES.pilots, {
  hasUpdatedAt: true,
  salvageSchema: PilotSchema.strip(),
})
export const mechs = makeStore(getDb, MechSchema, STORE_NAMES.mechs, {
  hasUpdatedAt: true,
  salvageSchema: MechSchema.strip(),
})
export const crawlers = makeStore(getDb, CrawlerSchema, STORE_NAMES.crawlers, {
  hasUpdatedAt: true,
  salvageSchema: CrawlerSchema.strip(),
})
export const workspaces = makeStore(getDb, WorkspaceSchema, STORE_NAMES.workspaces, {
  salvageSchema: WorkspaceSchema.strip(),
})
export const softLinks = makeStore(getDb, SoftLinkSchema, STORE_NAMES.softLinks, {
  salvageSchema: SoftLinkSchema.strip(),
})
export const mechPatterns = makeStore(getDb, MechPatternSchema, STORE_NAMES.mechPatterns, {
  salvageSchema: MechPatternSchema.strip(),
})
