/**
 * entityStore — Zustand store wrapping the Wave 1 db/ CRUD layer.
 *
 * Hydration strategy: lazy auto-hydration.
 * When list(type) is called and that type is not yet hydrated, hydrate(type)
 * is triggered automatically (returning a Promise the caller can await if they
 * need the result synchronously). This is more ergonomic than throwing "not
 * hydrated" because callers do not need to pre-call hydrate before every read.
 * Subsequent calls after hydration return the in-memory array synchronously
 * (no extra db round-trip).
 *
 * Write-through: create/update/delete persist to IndexedDB first. On success
 * the in-memory state is updated atomically via Zustand's set(). On failure
 * the db error propagates to the caller; in-memory state is not mutated.
 *
 * Multi-tab (plan 2.7): every successful write publishes the affected object
 * store via lib/db/broadcast; writes made by OTHER tabs invalidate this tab's
 * cache (already-hydrated stores are re-read from IndexedDB). Crawler-bay
 * edits go through updateCrawlerBay(), which merges a single bay entry onto
 * the freshest persisted record instead of replacing the whole array from a
 * possibly-stale in-memory copy.
 *
 * Integrity (plan 2.7): deleting a pilot/mech/crawler also prunes every
 * SoftLink whose `from` or `to` endpoint references it — no more orphaned
 * "Unknown pilot (id)" rows.
 */

import { create } from 'zustand'

import { getActiveWorkspaceId } from './activeWorkspaceStore'
import { recordDataWrite } from '../lib/backupNudge'
import { publishStoreChange, subscribeStoreChanges } from '../lib/db/broadcast'
import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { StoreName } from '../lib/db/stores'
import type { ChangeLogKind } from '../lib/schemas/changeLog'
import type { Crawler } from '../lib/schemas/crawler'
import type { Mech } from '../lib/schemas/mech'
import type { Pilot } from '../lib/schemas/pilot'
import type { SoftLink } from '../lib/schemas/softLink'
import type { CreateInput, EntityForType, EntityType } from './types'
import { requireWritableBackend } from './entityBackend'

// Re-exported so consumers can import the type alongside the store itself.
export type { EntityType }

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

export type EntityState = {
  pilots: Pilot[]
  mechs: Mech[]
  crawlers: Crawler[]
  softLinks: SoftLink[]
  hydrated: {
    pilots: boolean
    mechs: boolean
    crawlers: boolean
    softLinks: boolean
  }

  /**
   * Loads all records of the given type from IndexedDB into in-memory state.
   * Idempotent: subsequent calls when already hydrated are no-ops.
   */
  hydrate: (type: EntityType) => Promise<void>

  /**
   * Re-reads the given type from IndexedDB even when already hydrated.
   * Used for cross-tab invalidation; no-op when the type was never hydrated
   * (lazy hydration will read fresh data anyway).
   */
  rehydrate: (type: EntityType) => Promise<void>

  /**
   * Sync list — returns the in-memory array.
   * Auto-triggers hydrate() if not yet hydrated; callers that need the
   * result immediately should await hydrate(type) before calling list().
   */
  list: <T extends EntityType>(type: T) => EntityForType<T>[]

  /** Sync get — returns the entity by id or null. */
  get: <T extends EntityType>(type: T, id: string) => EntityForType<T> | null

  /** Persists to db then updates in-memory state. Zod errors propagate. */
  create: <T extends EntityType>(type: T, input: CreateInput<T>) => Promise<EntityForType<T>>

  /**
   * Merges patch, persists to db, updates in-memory state, then appends a
   * Change Log entry per changed field (provenance, ADR-022). `meta` tags those
   * entries — pass `{ kind: 'override', source: 'live-sheet' }` for a Free-Edit
   * cap override, `{ kind: 'transaction', source: 'dashboard' }` for an enforced
   * play transaction; the default is a `manual` edit from an unknown surface.
   */
  update: <T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta?: ChangeMeta
  ) => Promise<EntityForType<T>>

  /**
   * Merges a patch into ONE crawler bay entry (matched by bayRef) on top of
   * the freshest persisted record — concurrent edits to different bays from
   * different tabs no longer clobber each other's whole-array writes.
   * Throws when the crawler or the bay entry does not exist.
   */
  updateCrawlerBay: (
    crawlerId: string,
    bayRef: string,
    patch: Partial<Omit<CrawlerBayEntry, 'bayRef'>>,
    /**
     * Disambiguates when multiple entries share a bayRef: the entry at this
     * index is patched when its bayRef matches; otherwise the first bayRef
     * match wins.
     */
    index?: number,
    /** Change Log provenance for the resulting update (ADR-022). */
    meta?: ChangeMeta
  ) => Promise<Crawler>

  /**
   * Deletes from db and removes from in-memory state. Deleting a
   * pilot/mech/crawler also deletes every SoftLink referencing it.
   */
  delete: (type: EntityType, id: string) => Promise<void>

  /**
   * Cross-entity value transfer: validates every patch, then commits all
   * updates and deletes in ONE IndexedDB transaction (all-or-nothing). Use
   * for flows that move value between entities — scrap-mech, cargo
   * stow/load, salvage hand-offs — where a partial write would duplicate or
   * destroy player data. Deletes cascade SoftLinks like delete().
   */
  transfer: (
    ops: {
      updates?: TransferUpdate[]
      deletes?: { type: EntityType; id: string }[]
    },
    meta?: ChangeMeta
  ) => Promise<void>
}

/** One update inside a transfer() — the discriminant ties patch to type. */
export type TransferUpdate = {
  [T in EntityType]: { type: T; id: string; patch: Partial<EntityForType<T>> }
}[EntityType]

/**
 * Provenance tags for a Change Log entry (ADR-022). Both fields are optional;
 * an untagged update logs as a `manual` edit from an `unknown` source.
 */
export type ChangeMeta = {
  kind?: ChangeLogKind
  source?: string
}

const CHANGE_LOG_DEFAULT_KIND: ChangeLogKind = 'manual'
const CHANGE_LOG_DEFAULT_SOURCE = 'unknown'

/** Structural equality via JSON — entity fields are Zod-parsed, so key order is stable. */
function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * The fields a patch actually changed: for each key in `patch`, compare the
 * before-image against the persisted result and keep only the ones that moved.
 * `before` is null when the entity was not in memory at write time (the entry's
 * `before` is then undefined — best-effort provenance, see ADR-022).
 */
function changedFields<T extends EntityType>(
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>
): Array<{ field: string; before: unknown; after: unknown }> {
  const beforeRec = (before ?? {}) as Record<string, unknown>
  const afterRec = after as Record<string, unknown>
  const changes: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const field of Object.keys(patch)) {
    const prev = before === null ? undefined : beforeRec[field]
    const next = afterRec[field]
    if (!jsonEqual(prev, next)) changes.push({ field, before: prev, after: next })
  }
  return changes
}

/**
 * The single Change Log chokepoint (ADR-022): every entityStore.update appends
 * one entry per changed field here. Failure to log never fails the write — the
 * entity is already persisted, so a lost log line is warned, not thrown.
 */
async function emitChangeLog<T extends EntityType>(
  type: T,
  id: string,
  patch: Partial<EntityForType<T>>,
  before: EntityForType<T> | null,
  after: EntityForType<T>,
  meta: ChangeMeta | undefined
): Promise<void> {
  try {
    const changes = changedFields(patch, before, after)
    if (changes.length === 0) return
    const ts = Date.now()
    const kind = meta?.kind ?? CHANGE_LOG_DEFAULT_KIND
    const source = meta?.source ?? CHANGE_LOG_DEFAULT_SOURCE
    await db.changeLog.append(
      changes.map((c) => ({
        entityType: type,
        entityId: id,
        ts,
        kind,
        field: c.field,
        before: c.before,
        after: c.after,
        source,
      }))
    )
  } catch (err) {
    console.warn('[itun-store] change-log append failed', err)
  }
}

/** Maps EntityType discriminant to its db accessor and Zustand state key. */
type StoreKey = 'pilots' | 'mechs' | 'crawlers' | 'softLinks'

function storeKeyFor(type: EntityType): StoreKey {
  return `${type}s`
}

/**
 * The db accessor surface entityStore needs, expressed against EntityForType
 * so call sites keep the discriminant↔record-type link without `as any`
 * adapters (gap 36).
 */
type DbStoreApi<T extends EntityType> = {
  list: () => Promise<EntityForType<T>[]>
  get: (id: string) => Promise<EntityForType<T> | null>
  create: (input: CreateInput<T>) => Promise<EntityForType<T>>
  update: (id: string, patch: Partial<EntityForType<T>>) => Promise<EntityForType<T>>
  prepareUpdate: (id: string, patch: Partial<EntityForType<T>>) => Promise<EntityForType<T>>
  delete: (id: string) => Promise<void>
}

const DB_STORES: { [K in EntityType]: DbStoreApi<K> } = {
  pilot: db.pilots,
  mech: db.mechs,
  crawler: db.crawlers,
  softLink: db.softLinks,
}

function dbStoreFor<T extends EntityType>(type: T): DbStoreApi<T> {
  // Single correlated-union assertion: TS cannot carry the runtime
  // discriminant↔record-type invariant through the map lookup for a
  // generic T (microsoft/TypeScript#30581).
  return DB_STORES[type] as DbStoreApi<T>
}

/** Object-store name for broadcast messages. */
function broadcastNameFor(type: EntityType): StoreName {
  switch (type) {
    case 'pilot':
      return STORE_NAMES.pilots
    case 'mech':
      return STORE_NAMES.mechs
    case 'crawler':
      return STORE_NAMES.crawlers
    case 'softLink':
      return STORE_NAMES.softLinks
  }
}

function afterWrite(type: EntityType): void {
  publishStoreChange(broadcastNameFor(type))
  recordDataWrite()
}

/**
 * Stamp a brand-new build with the current workspace so it belongs somewhere
 * (mandatory current-workspace model — there is no unassigned pool any more).
 * Applies to pilots/mechs/crawlers only; SoftLinks carry no workspace, and an
 * input that already sets `workspaceId` (imports, explicit assignment) is left
 * untouched so it isn't clobbered.
 */
function withActiveWorkspace<T extends EntityType>(type: T, input: CreateInput<T>): CreateInput<T> {
  if (type === 'softLink') return input
  const rec = input as { workspaceId?: string }
  if (rec.workspaceId != null) return input
  return { ...input, workspaceId: getActiveWorkspaceId() } as CreateInput<T>
}

export const useEntityStore = create<EntityState>((set, get) => ({
  pilots: [],
  mechs: [],
  crawlers: [],
  softLinks: [],
  hydrated: {
    pilots: false,
    mechs: false,
    crawlers: false,
    softLinks: false,
  },

  async hydrate(type) {
    const key = storeKeyFor(type)
    if (get().hydrated[key]) return
    await get().rehydrate(type)
  },

  async rehydrate(type) {
    const key = storeKeyFor(type)
    const records = await dbStoreFor(type).list()
    set((state) => ({
      [key]: records,
      hydrated: { ...state.hydrated, [key]: true },
    }))
  },

  list<T extends EntityType>(type: T): EntityForType<T>[] {
    const key = storeKeyFor(type)
    const state = get()
    if (!state.hydrated[key]) {
      // Fire-and-forget — callers that need a fresh result should await hydrate first.
      void get().hydrate(type)
    }
    return state[key] as EntityForType<T>[]
  },

  get<T extends EntityType>(type: T, id: string): EntityForType<T> | null {
    const key = storeKeyFor(type)
    const state = get()
    if (!state.hydrated[key]) {
      void get().hydrate(type)
    }
    const arr = state[key] as EntityForType<T>[]
    return arr.find((e) => e.id === id) ?? null
  },

  async create<T extends EntityType>(type: T, input: CreateInput<T>): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Refuses rather than degrading when the server of record is unreachable
    // (ADR-030 §1): a signed-in user offline is read-only, not silently
    // writing to a local copy that would fork against the server.
    requireWritableBackend()
    const record = await dbStoreFor(type).create(withActiveWorkspace(type, input))
    set((state) => ({
      [key]: [record, ...(state[key] as EntityForType<T>[])],
    }))
    afterWrite(type)
    return record
  },

  async update<T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>,
    meta?: ChangeMeta
  ): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // Capture the before-image BEFORE the write so the Change Log can diff it.
    const before = get().get(type, id)
    requireWritableBackend()
    const updated = await dbStoreFor(type).update(id, patch)
    set((state) => ({
      [key]: (state[key] as EntityForType<T>[]).map((e) => (e.id === id ? updated : e)),
    }))
    afterWrite(type)
    // Provenance (ADR-022): one entry per changed field, at this one chokepoint.
    // Deliberately awaited (not fire-and-forget): the ~1ms IDB append is
    // negligible for a local-first app, and awaiting guarantees the log is
    // consistent the moment update() resolves — a reader that opens the Change
    // Log right after an edit sees the entry, and tests stay deterministic.
    await emitChangeLog(type, id, patch, before, updated, meta)
    return updated
  },

  async transfer(ops, meta) {
    const updates = ops.updates ?? []
    const deletes = ops.deletes ?? []
    if (updates.length === 0 && deletes.length === 0) return

    // Capture before-images BEFORE the write, exactly as update() does, so the
    // Change Log can diff them in phase 4. Without this, cross-entity moves
    // (cargo stow/load, scrap hand-offs) mutated entities with no provenance at
    // all — the one hole in ADR-022's "every mutation is logged" chokepoint
    // guarantee, since transfer() bypasses update().
    const withBefore = updates.map((u) => ({ ...u, before: get().get(u.type, u.id) }))

    // Phase 1 — validate everything BEFORE touching disk. prepareUpdate
    // merges + strict-parses without writing, so a Zod failure on any patch
    // aborts the whole transfer with nothing changed.
    const prepared = await Promise.all(
      withBefore.map(async (u) => ({
        type: u.type,
        id: u.id,
        patch: u.patch,
        before: u.before,
        record: await (
          dbStoreFor(u.type).prepareUpdate as (id: string, patch: object) => Promise<{ id: string }>
        )(u.id, u.patch),
      }))
    )

    // Phase 2 — one IDB transaction for every put and delete.
    const prunedIds = await db.atomicWrite([
      ...prepared.map((pu) => ({
        op: 'put' as const,
        storeName: broadcastNameFor(pu.type),
        record: pu.record,
      })),
      ...deletes.map((d) => ({
        op: 'delete' as const,
        storeName: broadcastNameFor(d.type),
        id: d.id,
        pruneSoftLinks: d.type !== 'softLink',
      })),
    ])

    // Phase 3 — sync in-memory state + broadcasts, mirroring update()/delete().
    const deletedByKey = new Map<StoreKey, Set<string>>()
    for (const d of deletes) {
      const key = storeKeyFor(d.type)
      deletedByKey.set(key, (deletedByKey.get(key) ?? new Set()).add(d.id))
    }
    const pruned = new Set(prunedIds)
    set((state) => {
      const next: Partial<Record<StoreKey, unknown[]>> = {}
      for (const pu of prepared) {
        const key = storeKeyFor(pu.type)
        const base = (next[key] ?? state[key]) as { id: string }[]
        next[key] = base.map((e) => (e.id === pu.record.id ? pu.record : e))
      }
      for (const [key, ids] of deletedByKey) {
        const base = (next[key] ?? state[key]) as { id: string }[]
        next[key] = base.filter((e) => !ids.has(e.id))
      }
      if (pruned.size > 0) {
        const base = (next.softLinks ?? state.softLinks) as { id: string }[]
        next.softLinks = base.filter((l) => !pruned.has(l.id))
      }
      return next as Partial<EntityState>
    })
    const touched = new Set<EntityType>([
      ...prepared.map((pu) => pu.type),
      ...deletes.map((d) => d.type),
    ])
    for (const type of touched) afterWrite(type)
    if (pruned.size > 0 && !touched.has('softLink')) {
      publishStoreChange(STORE_NAMES.softLinks)
    }

    // Phase 4 — provenance (ADR-022), mirroring update()'s awaited emit. One
    // entry per changed field per updated entity. Deletes are not logged: the
    // per-entity log goes with the entity.
    for (const pu of prepared) {
      await emitChangeLog(
        pu.type,
        pu.id,
        pu.patch,
        pu.before,
        pu.record as EntityForType<typeof pu.type>,
        meta
      )
    }
  },

  async updateCrawlerBay(crawlerId, bayRef, patch, index, meta) {
    // Read the freshest persisted record — NOT the in-memory copy — so two
    // tabs editing different bays merge instead of clobbering (plan 2.7).
    const fresh = await db.crawlers.get(crawlerId)
    if (fresh === null) {
      throw new Error(`[itun-store] Cannot update bay: crawler id="${crawlerId}" not found`)
    }
    const bays = fresh.crawlerBays ?? []
    const targetIndex =
      index !== undefined && bays[index]?.bayRef === bayRef
        ? index
        : bays.findIndex((b) => b.bayRef === bayRef)
    if (targetIndex === -1) {
      throw new Error(
        `[itun-store] Cannot update bay: bayRef="${bayRef}" not found on crawler "${crawlerId}"`
      )
    }
    const next = bays.map((b, i) => (i === targetIndex ? { ...b, ...patch, bayRef } : b))
    return get().update('crawler', crawlerId, { crawlerBays: next }, meta)
  },

  async delete(type, id) {
    const key = storeKeyFor(type)
    requireWritableBackend()

    // Cascade: deleting an entity prunes its SoftLinks (plan 2.7, gap 9).
    // The entity delete and its link pruning run in a single IDB transaction
    // (deleteEntityWithSoftLinks) so a crash/error can never leave orphaned
    // links or a half-applied delete — it is all-or-nothing on disk.
    if (type !== 'softLink') {
      const prunedIds = await db.deleteEntityWithSoftLinks(broadcastNameFor(type), id)
      if (prunedIds.length > 0) {
        const pruned = new Set(prunedIds)
        set((state) => ({
          softLinks: state.softLinks.filter((l) => !pruned.has(l.id)),
        }))
        publishStoreChange(STORE_NAMES.softLinks)
      }
      set((state) => ({
        [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
      }))
      afterWrite(type)
      return
    }

    await dbStoreFor(type).delete(id)
    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
    }))
    afterWrite(type)
  },
}))

// ---------------------------------------------------------------------------
// Cross-tab invalidation: when ANOTHER tab announces a write to one of our
// object stores, re-read it from IndexedDB (only if this tab already holds a
// hydrated copy — otherwise lazy hydration will fetch fresh data on demand).
// ---------------------------------------------------------------------------
const BROADCAST_TO_TYPE: Partial<Record<StoreName, EntityType>> = {
  [STORE_NAMES.pilots]: 'pilot',
  [STORE_NAMES.mechs]: 'mech',
  [STORE_NAMES.crawlers]: 'crawler',
  [STORE_NAMES.softLinks]: 'softLink',
}

subscribeStoreChanges((storeName) => {
  const type = BROADCAST_TO_TYPE[storeName]
  if (type === undefined) return
  const state = useEntityStore.getState()
  if (!state.hydrated[storeKeyFor(type)]) return
  void state.rehydrate(type)
})
