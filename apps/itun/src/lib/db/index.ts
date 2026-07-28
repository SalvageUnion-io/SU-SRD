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
import { deepStrip } from '../schemas/deepStrip'
import { EncounterNpcSchema } from '../schemas/encounterNpc'
import { MechSchema } from '../schemas/mech'
import { MechPatternSchema } from '../schemas/pattern'
import { PilotSchema } from '../schemas/pilot'
import { SoftLinkSchema } from '../schemas/softLink'
import { WorkspaceSchema } from '../schemas/workspace'
import { CHANGE_LOG_ENTITY_INDEX, makeChangeLogStore } from './changeLog'
import { makeStore } from './crud'
import { runMigrations } from './migrations/index'
import { STORE_NAMES } from './stores'

/**
 * Current IndexedDB schema version. Bump together with a migrations/ entry.
 * (v7 is a version-only bump — it once carried an eager Starter Set seed, now
 * replaced by on-demand seeding in lib/starterSet/seedStarterSet.ts. v8 heals
 * Battle crawlers whose maxSpModifier hand-carried the type's +5 — the bonus
 * is now derived at read from the type's mutations. v9 creates the append-only
 * `changeLog` (provenance) store — creation only, no record rewrite; ADR-022.
 * v10 creates the mandatory built-in Default workspace and backfills every
 * unassigned pilot/mech/crawler/encounterNpc into it — the current-workspace
 * model replaces the old cross-workspace "All Builds" view; see
 * lib/defaultWorkspace.ts.)
 */
export const DB_VERSION = 12

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
 * The canonical opener: object-store creation + registered record-rewrite
 * migrations. Exported (with a name parameter) so the migration test suite
 * can exercise the full upgrade path against a dedicated throwaway database
 * without touching the app database other test files share.
 *
 * `runMigrationsFn` is a test-only seam: production callers omit it and get
 * the registered migrations. The migration suite injects a throwing runner to
 * verify that a failed migration aborts the upgrade and rejects the open
 * (rather than being swallowed) — see migrations.test.ts.
 */
export function openItunDatabase(
  name: string = DB_NAME,
  runMigrationsFn: typeof runMigrations = runMigrations,
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
      async upgrade(db, oldVersion, _newVersion, transaction) {
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
        // v5 (design-review R-5): add encounterNpcs object store (GM encounter
        // tray). Store creation only — no record rewrites.
        if (oldVersion < 5) {
          if (!db.objectStoreNames.contains(STORE_NAMES.encounterNpcs)) {
            db.createObjectStore(STORE_NAMES.encounterNpcs, { keyPath: 'id' })
          }
        }
        // v9 (ADR-022): append-only Change Log (provenance) store. autoIncrement
        // `seq` primary key (total order) + a `by-entity` index for per-entity
        // history reads. Store creation only — no record rewrite.
        if (oldVersion < 9) {
          if (!db.objectStoreNames.contains(STORE_NAMES.changeLog)) {
            const changeLogStore = db.createObjectStore(STORE_NAMES.changeLog, {
              keyPath: 'seq',
              autoIncrement: true,
            })
            changeLogStore.createIndex(CHANGE_LOG_ENTITY_INDEX, 'entityId')
          }
        }
        // v3+: record rewrites live in migrations/ — one file per version.
        // runMigrations only awaits IDB operations on `transaction`, so the
        // versionchange transaction stays open until every rewrite lands.
        // On failure we abort the transaction: that rolls back the version bump
        // AND surfaces as an error on the open request, so openItunDatabase()
        // rejects rather than handing back a half-migrated database. We do NOT
        // rethrow — idb does not await the upgrade callback's promise, so a
        // rejected upgrade would become an unhandled rejection; abort() alone
        // already fails the open with the failure logged below.
        try {
          await runMigrationsFn(db, transaction, oldVersion)
        } catch (err) {
          console.error('[itun-db] Migration failed — aborting upgrade transaction.', err)
          // Guard against a transaction that already settled (e.g. auto-committed
          // if a migration ever awaited a non-IDB promise) so abort() throwing
          // cannot itself become an unhandled rejection.
          try {
            // idb eagerly wires `transaction.done`; aborting rejects it. Nothing
            // on the upgrade path awaits .done, so mark that rejection handled to
            // keep it from surfacing as an unhandled rejection.
            void transaction.done.catch(() => {})
            transaction.abort()
          } catch {
            // already aborted/committed — nothing more to do
          }
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
 * ITUN keeps every pilot/mech/crawler in this one browser's IndexedDB with no
 * backend, so a UA that evicts "best-effort" storage under disk pressure (or
 * Safari's ITP 7-day cap) can silently wipe all player data. Asking for the
 * `persistent` bucket makes the store eviction-resistant. This is hardening,
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

/**
 * Atomically deletes an entity and every SoftLink that references it (by
 * `from.id` or `to.id`) in a single readwrite transaction spanning the entity
 * store and the softLinks store. Either the entity and all its links are
 * removed together, or — on any error — the transaction aborts and nothing
 * changes (no orphaned links, no half-applied delete). Returns the ids of the
 * pruned SoftLinks so the caller can update in-memory state to match.
 *
 * `entityStoreName` must be a pilot/mech/crawler store — the only entities
 * SoftLinks point at.
 */
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
 * the store's prepareUpdate()). Returns the ids of SoftLinks pruned by
 * `pruneSoftLinks` deletes so callers can sync in-memory state.
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

export async function deleteEntityWithSoftLinks(
  entityStoreName: string,
  id: string
): Promise<string[]> {
  const db = await getDb()
  const tx = db.transaction([entityStoreName, STORE_NAMES.softLinks], 'readwrite')
  const linkStore = tx.objectStore(STORE_NAMES.softLinks)
  const allLinks = (await linkStore.getAll()) as Array<{
    id: string
    from: { id: string }
    to: { id: string }
  }>
  const prunedIds: string[] = []
  for (const link of allLinks) {
    if (link.from.id === id || link.to.id === id) {
      await linkStore.delete(link.id)
      prunedIds.push(link.id)
    }
  }
  await tx.objectStore(entityStoreName).delete(id)
  await tx.done
  return prunedIds
}

// Per-entity store accessors
// hasUpdatedAt=true for Pilot, Mech, Crawler (their schemas include updatedAt)
// hasUpdatedAt=false (default) for Workspace (createdAt only), SoftLink (createdAt only),
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
})
export const mechs = makeStore(getDb, MechSchema, STORE_NAMES.mechs, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(MechSchema),
})
export const crawlers = makeStore(getDb, CrawlerSchema, STORE_NAMES.crawlers, {
  hasUpdatedAt: true,
  salvageSchema: deepStrip(CrawlerSchema),
})
export const workspaces = makeStore(getDb, WorkspaceSchema, STORE_NAMES.workspaces, {
  salvageSchema: deepStrip(WorkspaceSchema),
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

// ADR-022: append-only per-entity Change Log (provenance). Not an entity
// store — no makeStore CRUD; see ./changeLog.ts for its append/list surface.
export const changeLog = makeChangeLogStore(getDb)
