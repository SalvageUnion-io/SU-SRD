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
 * Version changes:
 *   - The database is a cache of Convex (ADR-034), so an upgrade never
 *     rewrites a record: it drops every store an older version holds and
 *     creates the current set empty. `ShelfSync` and `WiringSync` refill them
 *     from the server on the next signed-in load.
 *   - Reads additionally get a salvage path (see makeStore options): drifted
 *     records are stripped/defaulted with a console warning instead of
 *     bricking store hydration — the safety net for version skew between a
 *     tab's bundle and the rows the server hands it.
 */

import type { IDBPDatabase } from 'idb'
import { openDB } from 'idb'
import { CrawlerSchema } from '../schemas/crawler'
import { deepStrip } from '../schemas/deepStrip'
import { EncounterNpcSchema } from '../schemas/encounterNpc'
import { MechSchema } from '../schemas/mech'
import { MechPatternSchema } from '../schemas/pattern'
import { normalizeLegacyPilotRecord, PilotSchema } from '../schemas/pilot'
import { SoftLinkSchema } from '../schemas/softLink'
import type { CacheMeta } from './cacheMeta'
import { CACHE_META_ID, cacheMetaRecord, parseCacheMeta } from './cacheMeta'
import { makeStore } from './crud'
import { STORE_NAMES } from './stores'

/**
 * Current IndexedDB schema version. Bump it whenever the set of stores or the
 * shape of a cached record changes: the upgrade empties the cache and the
 * server refills it, so there is nothing else to write.
 */
export const DB_VERSION = 19

const DB_NAME = 'itun-v1'

/**
 * How long to wait after a `blocked` event before giving up on the upgrade.
 * A blocked upgrade (another live connection holds the previous version open,
 * e.g. this site in another tab on an older build) leaves the open pending
 * INDEFINITELY. We give the blocking connection a brief window to close, then
 * reject so the UI can recover instead of hanging on the loading skeleton.
 */
const BLOCKED_UPGRADE_GRACE_MS = 3000

/**
 * Thrown when opening the database needs a version upgrade but another live
 * connection blocks it (typically this site open in another tab on an older
 * build). IndexedDB leaves such an open pending forever; surfacing it as a
 * typed error lets the root error boundary show a "close other tabs and reload"
 * recovery screen rather than an endless loading state.
 */
export class BlockedUpgradeError extends Error {
  constructor() {
    super(
      'IndexedDB upgrade is blocked by another open connection. Close other ' +
        'tabs running In the Union Now, then reload.'
    )
    this.name = 'BlockedUpgradeError'
  }
}

/** Singleton promise — openDB is called once per page load. */
let dbPromise: Promise<IDBPDatabase> | null = null

/**
 * The canonical opener. Exported (with a name parameter) so the upgrade tests
 * can exercise it against a dedicated throwaway database without touching the
 * app database other test files share.
 *
 * The upgrade empties the cache rather than migrating it: every store an older
 * version created is deleted — including stores this version no longer has —
 * and the current set is created empty. With no `meta` row the cache belongs
 * to nobody (`cacheMeta.ts`), so the next signed-in load claims it for that
 * account and refills it from Convex.
 */
export function openItunDatabase(
  name: string = DB_NAME,
  blockedGraceMs: number = BLOCKED_UPGRADE_GRACE_MS
): Promise<IDBPDatabase> {
  return new Promise<IDBPDatabase>((resolve, reject) => {
    let settled = false
    let blockedTimer: ReturnType<typeof setTimeout> | undefined

    const finish = (run: () => void): void => {
      if (settled) return
      settled = true
      if (blockedTimer !== undefined) clearTimeout(blockedTimer)
      run()
    }

    const open = openDB(name, DB_VERSION, {
      upgrade(db) {
        for (const storeName of [...db.objectStoreNames]) db.deleteObjectStore(storeName)
        for (const storeName of Object.values(STORE_NAMES)) {
          db.createObjectStore(storeName, { keyPath: 'id' })
        }
      },
      blocked() {
        console.warn(
          '[itun-db] Upgrade blocked by another open connection — waiting for it to close.'
        )
        if (blockedTimer !== undefined) clearTimeout(blockedTimer)
        blockedTimer = setTimeout(() => {
          finish(() => reject(new BlockedUpgradeError()))
        }, blockedGraceMs)
      },
      blocking() {
        // This (older) connection is blocking a newer tab's upgrade. We only
        // log: the active tab keeps working and the blocked tab surfaces its own
        // recovery prompt. Auto-closing here would brick this tab's cached
        // connection mid-session.
        console.warn('[itun-db] This connection is blocking an upgrade in another tab.')
      },
    })

    open.then(
      (db) => {
        // If we already rejected on the blocked-grace timeout, the upgrade
        // eventually went through once the other tab closed — close the orphaned
        // connection so it does not itself block a future upgrade.
        if (settled) {
          void db.close()
          return
        }
        finish(() => resolve(db))
      },
      (err: unknown) => finish(() => reject(err))
    )
  })
}

/**
 * Best-effort request for persistent (eviction-resistant) storage.
 *
 * IndexedDB is a cache of Convex, so an eviction loses no player data, but a
 * UA that evicts "best-effort" storage under disk pressure (or Safari's ITP
 * 7-day cap) empties what a Disconnected reader can still open. Asking for the
 * `persistent` bucket makes the cache eviction-resistant. This is hardening,
 * never a hard requirement: we ask once (skip if already granted so we don't
 * re-prompt), guard on API existence, and swallow every error — the whole body
 * is try/caught so the returned promise can NEVER reject (a fire-and-forget
 * rejection would surface as an unhandled rejection).
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage?.persist || !storage.persisted) return
    if (await storage.persisted()) return
    await storage.persist()
  } catch {
    // best-effort only — never block or surface
  }
}

/** Lazy singleton accessor for the app database — module-private. */
function getDb(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    const opening = openItunDatabase()
    dbPromise = opening
    // Do NOT cache a rejected open for the page's lifetime. A blocked upgrade
    // (BlockedUpgradeError) resolves the moment the user closes the other tab —
    // dropping the cached rejection lets the next getDb() retry cleanly instead
    // of replaying the same failure. Only clear if we still own this promise
    // (a concurrent reset/success must not be clobbered).
    opening.catch(() => {
      if (dbPromise === opening) dbPromise = null
    })
    // Fire-and-forget on first open: ask the UA to make this origin's storage
    // eviction-resistant. Never awaited, never rejects (see helper).
    void requestPersistentStorage()
  }
  return dbPromise
}

/**
 * Resets the DB singleton. Used in tests to force a new connection on next
 * operation. Call this before `clearCache()` so the next getDb() opens a fresh
 * connection to the (now-empty) stores.
 * Test-only — not re-exported from the package public surface.
 */
export function _resetDbSingleton(): void {
  dbPromise = null
}

/** Where this browser's rows came from, and whose they are (`cacheMeta.ts`). */
export async function readCacheMeta(): Promise<CacheMeta> {
  const db = await getDb()
  return parseCacheMeta(await db.get(STORE_NAMES.meta, CACHE_META_ID))
}

/** Record where this browser's rows came from, and whose they are. */
export async function writeCacheMeta(meta: CacheMeta): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAMES.meta, cacheMetaRecord(meta))
}

/**
 * Empty the cache and hand it to `userId` (`null`: to nobody), in one
 * transaction.
 *
 * Every store goes: the cache is one account's, and another account's rows are
 * not this one's to read. The meta row is rewritten rather than left, so the
 * result is owned by `userId`.
 */
export async function clearCache(userId: string | null = null): Promise<void> {
  const db = await getDb()
  const names = Object.values(STORE_NAMES)
  const tx = db.transaction(names, 'readwrite')
  await Promise.all(names.map((name) => tx.objectStore(name).clear()))
  await tx.objectStore(STORE_NAMES.meta).put(cacheMetaRecord({ userId }))
  await tx.done
}

/** One write inside an atomicWrite() transaction. */
export type AtomicWriteOp =
  | { op: 'put'; storeName: string; record: { id: string } }
  | { op: 'delete'; storeName: string; id: string; pruneSoftLinks?: boolean }

/**
 * Commits several puts/deletes — possibly spanning multiple object stores —
 * in ONE readwrite transaction (audit item 2: cross-entity value transfers
 * like scrap-mech, cargo hand-off, and salvage deposits must be
 * all-or-nothing; two sequential writes can duplicate or vanish player value
 * if the second fails). On any error the transaction aborts and nothing
 * changes. Records passed to `put` must already be schema-validated (use
 * the store's prepareUpdate()). A delete with `pruneSoftLinks` also removes
 * every SoftLink whose `from.id` or `to.id` is the deleted id — the one way an
 * entity delete cascades on this device. Returns the ids of the pruned
 * SoftLinks so callers can sync in-memory state.
 */
export async function atomicWrite(ops: AtomicWriteOp[]): Promise<string[]> {
  if (ops.length === 0) return []
  const db = await getDb()
  const storeNames = new Set(ops.map((o) => o.storeName))
  if (ops.some((o) => o.op === 'delete' && o.pruneSoftLinks)) {
    storeNames.add(STORE_NAMES.softLinks)
  }
  const tx = db.transaction([...storeNames], 'readwrite')
  const prunedIds: string[] = []
  for (const op of ops) {
    if (op.op === 'put') {
      await tx.objectStore(op.storeName).put(op.record)
      continue
    }
    if (op.pruneSoftLinks) {
      const linkStore = tx.objectStore(STORE_NAMES.softLinks)
      const allLinks = (await linkStore.getAll()) as Array<{
        id: string
        from: { id: string }
        to: { id: string }
      }>
      for (const link of allLinks) {
        if (link.from.id === op.id || link.to.id === op.id) {
          await linkStore.delete(link.id)
          prunedIds.push(link.id)
        }
      }
    }
    await tx.objectStore(op.storeName).delete(op.id)
  }
  await tx.done
  return prunedIds
}

// Per-entity store accessors
// hasUpdatedAt=true for Pilot, Mech, Crawler (their schemas include updatedAt)
// hasUpdatedAt=false (default) for SoftLink (createdAt only)
// and MechPattern (createdAt only — patterns are immutable after creation).
// salvageSchema = deepStrip(XSchema) — the same shape with EVERY object
// (top-level and nested, e.g. CargoLotSchema/InjurySchema/EntityRefSchema
// inside cargoLots/injuries/from/to) relaxed to `.strip()` instead of
// `.strict()`. A plain `XSchema.strip()` only relaxes the outermost object;
// an unknown key introduced at any nested depth by a newer build would still
// fail the salvage parse and drop the whole record. See deepStrip.ts.

export const pilots = makeStore(getDb, PilotSchema, STORE_NAMES.pilots, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(PilotSchema),
  // A pilot cached from a Convex row stored before a field was removed still
  // carries it; heal it on the way in rather than warning through salvage.
  normalize: normalizeLegacyPilotRecord,
})
export const mechs = makeStore(getDb, MechSchema, STORE_NAMES.mechs, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(MechSchema),
})
export const crawlers = makeStore(getDb, CrawlerSchema, STORE_NAMES.crawlers, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(CrawlerSchema),
})
export const softLinks = makeStore(getDb, SoftLinkSchema, STORE_NAMES.softLinks, {
  salvageSchema: deepStrip(SoftLinkSchema),
})
export const mechPatterns = makeStore(getDb, MechPatternSchema, STORE_NAMES.mechPatterns, {
  salvageSchema: deepStrip(MechPatternSchema),
})
export const encounterNpcs = makeStore(getDb, EncounterNpcSchema, STORE_NAMES.encounterNpcs, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(EncounterNpcSchema),
})
