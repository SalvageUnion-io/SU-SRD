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
 */

import { create } from 'zustand'

import * as db from '../lib/db/index'
import type { Crawler } from '../lib/schemas/crawler'
import type { Mech } from '../lib/schemas/mech'
import type { Pilot } from '../lib/schemas/pilot'
import type { SoftLink } from '../lib/schemas/softLink'
import type { AssignableType, CreateInput, EntityForType, EntityType } from './types'

// Re-export for consumers that only import from the stores barrel.
export type { AssignableType, CreateInput, EntityForType, EntityType }

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

  /** Deletes from db and removes from in-memory state. */
  delete: (type: EntityType, id: string) => Promise<void>
}

/** Maps EntityType discriminant to its db accessor and Zustand state key. */
type StoreKey = 'pilots' | 'mechs' | 'crawlers' | 'softLinks'

function storeKeyFor(type: EntityType): StoreKey {
  return (type + 's') as StoreKey
}

function dbStoreFor(type: EntityType) {
  switch (type) {
    case 'pilot':
      return db.pilots
    case 'mech':
      return db.mechs
    case 'crawler':
      return db.crawlers
    case 'softLink':
      return db.softLinks
  }
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const records = await (dbStoreFor(type).list() as Promise<any[]>)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = await (dbStoreFor(type).create(input as any) as Promise<EntityForType<T>>)
    set((state) => ({
      [key]: [record, ...(state[key] as EntityForType<T>[])],
    }))
    return record
  },

  async update<T extends EntityType>(
    type: T,
    id: string,
    patch: Partial<EntityForType<T>>
  ): Promise<EntityForType<T>> {
    const key = storeKeyFor(type)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (dbStoreFor(type).update(id, patch as any) as Promise<EntityForType<T>>)
    set((state) => ({
      [key]: (state[key] as EntityForType<T>[]).map((e) => (e.id === id ? updated : e)),
    }))
    return updated
  },

  async delete(type, id) {
    const key = storeKeyFor(type)
    await dbStoreFor(type).delete(id)
    set((state) => ({
      [key]: (state[key] as { id: string }[]).filter((e) => e.id !== id),
    }))
  },
}))
