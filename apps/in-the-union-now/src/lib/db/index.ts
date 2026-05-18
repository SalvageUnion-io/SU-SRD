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
 * Migration strategy:
 *   - v1 schema (this file) is the floor. Each entity Zod schema carries
 *     `schemaVersion: z.literal(1)`.
 *   - Future schema upgrades land in `migrations/<n>-<description>.ts` and
 *     are called from the `upgrade` callback in openDB() below.
 *   - The `upgrade` callback receives `oldVersion`; add a `case` per version
 *     (no fall-through) to apply incremental changes (addObjectStore,
 *     createIndex, etc.).
 *   - Consumers should never write migrations inline here — one file per
 *     migration keeps git blame clean.
 */

import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'

import { CrawlerSchema } from '../schemas/crawler'
import { MechSchema } from '../schemas/mech'
import { PilotSchema } from '../schemas/pilot'
import { SoftLinkSchema } from '../schemas/softLink'
import { WorkspaceSchema } from '../schemas/workspace'
import { makeStore } from './crud'
import { STORE_NAMES } from './stores'

/** Singleton promise — openDB is called once per page load. */
let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    dbPromise = openDB('itun-v1', 1, {
      upgrade(db) {
        // v1: create all object stores with keyPath = 'id'
        for (const storeName of Object.values(STORE_NAMES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        }
        // Future migrations: see migrations/ directory.
      },
    })
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
// hasUpdatedAt=false (default) for Workspace (createdAt only) and SoftLink (createdAt only)

export const pilots = makeStore(getDb, PilotSchema, STORE_NAMES.pilots, true)
export const mechs = makeStore(getDb, MechSchema, STORE_NAMES.mechs, true)
export const crawlers = makeStore(getDb, CrawlerSchema, STORE_NAMES.crawlers, true)
export const workspaces = makeStore(getDb, WorkspaceSchema, STORE_NAMES.workspaces, false)
export const softLinks = makeStore(getDb, SoftLinkSchema, STORE_NAMES.softLinks, false)
