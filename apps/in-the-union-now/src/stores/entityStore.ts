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

import { recordDataWrite } from '../lib/backupNudge'
import { publishStoreChange, subscribeStoreChanges } from '../lib/db/broadcast'
import * as db from '../lib/db/index'
import { STORE_NAMES } from '../lib/db/stores'
import type { StoreName } from '../lib/db/stores'
import type { Crawler } from '../lib/schemas/crawler'
import type { Mech } from '../lib/schemas/mech'
import type { Pilot } from '../lib/schemas/pilot'
import type { SoftLink } from '../lib/schemas/softLink'
import type { CreateInput, EntityForType, EntityType } from './types'

// Re-export for consumers that only import from the stores barrel.
export type { EntityType }

type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

type EntityState = {
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

  /** Merges patch, persists to db, updates in-memory state. */
  update: <T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>
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
    index?: number
  ) => Promise<Crawler>

  /**
   * Deletes from db and removes from in-memory state. Deleting a
   * pilot/mech/crawler also deletes every SoftLink referencing it.
   */
  delete: (type: EntityType, id: string) => Promise<void>
}

/** Maps EntityType discriminant to its db accessor and Zustand state key. */
type StoreKey = 'pilots' | 'mechs' | 'crawlers' | 'softLinks'

function storeKeyFor(type: EntityType): StoreKey {
  return (type + 's') as StoreKey
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
    const record = await dbStoreFor(type).create(input)
    set((state) => ({
      [key]: [record, ...(state[key] as EntityForType<T>[])],
    }))
    afterWrite(type)
    return record
  },

  async update<T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>
  ): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    const updated = await dbStoreFor(type).update(id, patch)
    set((state) => ({
      [key]: (state[key] as EntityForType<T>[]).map((e) => (e.id === id ? updated : e)),
    }))
    afterWrite(type)
    return updated
  },

  async updateCrawlerBay(crawlerId, bayRef, patch, index) {
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
    return get().update('crawler', crawlerId, { crawlerBays: next })
  },

  async delete(type, id) {
    const key = storeKeyFor(type)

    // Cascade: deleting an entity prunes its SoftLinks (plan 2.7, gap 9).
    if (type !== 'softLink') {
      const attached = (await db.softLinks.list()).filter((l) => l.from.id === id || l.to.id === id)
      for (const link of attached) {
        await db.softLinks.delete(link.id)
      }
      if (attached.length > 0) {
        const prunedIds = new Set(attached.map((l) => l.id))
        set((state) => ({
          softLinks: state.softLinks.filter((l) => !prunedIds.has(l.id)),
        }))
        publishStoreChange(STORE_NAMES.softLinks)
      }
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
