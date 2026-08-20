/**
 * makeHydratedCollection — the shared skeleton behind every single-collection
 * Zustand store (audit item 22).
 *
 * encounterStore and patternStore both follow the same
 * discipline (ADR-003): lazy auto-hydration from IndexedDB on first read,
 * write-through persistence (db first, then in-memory set()), cross-tab
 * invalidation via lib/db/broadcast, and the backup nudge on every write.
 * Before this factory each store hand-rolled that skeleton (~650 lines
 * across three copies) — which is exactly how mechPatterns ended up
 * BYPASSING the layer entirely (direct db reads, no broadcast, no nudge).
 *
 * The collection key is parametrized (`encounterNpcs`,
 * `mechPatterns`) so each store's public state shape is unchanged —
 * existing selectors keep working. Domain helpers (encounter
 * listForContainer) stay in the owning store file, spread around
 * this slice.
 *
 * entityStore is deliberately NOT built on this: it multiplexes four entity
 * types through one store (plus transfer/softLink cascade) and shares only
 * the philosophy, not the shape.
 */

import { recordDataWrite } from '../lib/backupNudge'
import { publishStoreChange, subscribeStoreChanges } from '../lib/db/broadcast'
import type { StoreName } from '../lib/db/stores'

type DbCollection<T, CreateInput> = {
  list: () => Promise<T[]>
  create: (input: CreateInput) => Promise<T>
  update: (id: string, patch: Partial<T>) => Promise<T>
  delete: (id: string) => Promise<void>
}

/** The CRUD + hydration surface every collection store shares. */
export type HydratedCollectionSlice<K extends string, T> = Record<K, T[]> & {
  hydrated: boolean
  /** Loads the collection from IndexedDB. Idempotent. */
  hydrate: () => Promise<void>
  /** Re-reads from IndexedDB even when already hydrated (cross-tab). */
  rehydrate: () => Promise<void>
  /** Sync list — returns in-memory records. Auto-triggers hydrate if needed. */
  list: () => T[]
  /** Sync get by id or null. */
  get: (id: string) => T | null
}

export type HydratedCollectionActions<T, CreateInput> = {
  /** Persists to db then prepends to in-memory state. Zod errors propagate. */
  create: (input: CreateInput) => Promise<T>
  /** Merges patch, persists to db, updates in-memory state. */
  update: (id: string, patch: Partial<T>) => Promise<T>
  /** Deletes from db and removes from in-memory state. */
  delete: (id: string) => Promise<void>
}

type SliceConfig<K extends string, T, CreateInput> = {
  /** State key holding the array — preserved per store for selector compat. */
  key: K
  /**
   * Where this collection persists, resolved **per call** rather than captured.
   *
   * A function rather than a value because the answer changes with auth state:
   * an anonymous visitor writes to a Map that never touches disk (ADR-034
   * decision 1), and a signed-in one writes to IndexedDB. Capturing the
   * collection once at module scope would pin whichever backend happened to be
   * current when the store file was first imported — for a page loaded signed
   * out, that is the memory store *for the rest of the session*, including
   * after signing in.
   *
   * This mirrors `entityStore`'s `dbStoreFor` for the same reason and should
   * stay in step with it.
   */
  db: () => DbCollection<T, CreateInput>
  /** Broadcast channel name; also drives the cross-tab subscription. */
  storeName: StoreName
  /**
   * Whether a write should be announced to other tabs.
   *
   * Anonymous sessions do not broadcast: two tabs hold two unrelated Maps, so
   * telling tab B to re-read would blank the work it is holding. Optional so
   * a store with no anonymous mode keeps its current behaviour by saying
   * nothing.
   */
  shouldBroadcast?: () => boolean
}

type SetLike = (partial: object | ((state: never) => object)) => void
type GetLike<S> = () => S

/**
 * Build the shared slice. Spread the result into the store's create()
 * callback, then call wireCrossTabInvalidation(useStore) once per store.
 */
export function makeHydratedCollectionSlice<
  K extends string,
  T extends { id: string },
  CreateInput,
>(config: SliceConfig<K, T, CreateInput>) {
  const { key, db, storeName, shouldBroadcast } = config

  function afterWrite(): void {
    if (shouldBroadcast === undefined || shouldBroadcast()) publishStoreChange(storeName)
    recordDataWrite()
  }

  return function slice(
    set: SetLike,
    get: GetLike<HydratedCollectionSlice<K, T>>
  ): HydratedCollectionSlice<K, T> & HydratedCollectionActions<T, CreateInput> {
    const records = () => get()[key] as T[]
    return {
      // Irreducible double-cast: TS widens a computed single-key literal to a
      // string index signature, which it will not relate to Record<K, T[]> for
      // a generic K even via a direct assertion (design limitation, same
      // family as microsoft/TypeScript#30581).
      ...({ [key]: [] } as unknown as Record<K, T[]>),
      hydrated: false,

      async hydrate() {
        if (get().hydrated) return
        await get().rehydrate()
      },

      async rehydrate() {
        const loaded = await db().list()
        set({ [key]: loaded, hydrated: true })
      },

      list() {
        if (!get().hydrated) {
          void get().hydrate()
        }
        return records()
      },

      get(id) {
        if (!get().hydrated) {
          void get().hydrate()
        }
        return records().find((r) => r.id === id) ?? null
      },

      async create(input) {
        const record = await db().create(input)
        set({ [key]: [record, ...records()] })
        afterWrite()
        return record
      },

      async update(id, patch) {
        const updated = await db().update(id, patch)
        set({ [key]: records().map((r) => (r.id === id ? updated : r)) })
        afterWrite()
        return updated
      },

      async delete(id) {
        await db().delete(id)
        set({ [key]: records().filter((r) => r.id !== id) })
        afterWrite()
      },
    }
  }
}

/**
 * Cross-tab invalidation: when ANOTHER tab announces a write to this
 * collection's object store, re-read it (only when this tab already holds a
 * hydrated copy — lazy hydration covers the rest).
 */
export function wireCrossTabInvalidation(
  useStore: { getState: () => { hydrated: boolean; rehydrate: () => Promise<void> } },
  storeName: StoreName
): void {
  subscribeStoreChanges((changed) => {
    if (changed !== storeName) return
    const state = useStore.getState()
    if (!state.hydrated) return
    void state.rehydrate()
  })
}
