/**
 * makeHydratedCollection — the shared skeleton behind every single-collection
 * Zustand store (audit item 22).
 *
 * encounterStore and patternStore both follow the same
 * discipline: lazy auto-hydration from IndexedDB on first read (ADR-003) and
 * server-first persistence (server, then db, then in-memory set(); ADR-034). Another
 * tab's writes arrive through this tab's own Convex subscription: `ShelfSync`
 * adopts its creates and edits and forgets its deletes. There is no tab-to-tab
 * channel.
 * Before this factory each store hand-rolled that skeleton (~650 lines
 * across three copies) — which is exactly how mechPatterns ended up
 * BYPASSING the layer entirely (direct db reads).
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

import { captureException } from '../lib/observability'
import { readableRows, requireWritableBackend } from './entityBackend'

type DbCollection<T, CreateInput> = {
  list: () => Promise<T[]>
  create: (input: CreateInput) => Promise<T>
  update: (id: string, patch: Partial<T>) => Promise<T>
  delete: (id: string) => Promise<void>
  /** Writes a server-provided record verbatim. Used by {@link HydratedCollectionActions.adopt}. */
  put: (record: T) => Promise<T>
}

/** The CRUD + hydration surface every collection store shares. */
export type HydratedCollectionSlice<K extends string, T> = Record<K, T[]> & {
  hydrated: boolean
  /** Loads the collection from IndexedDB (nothing signed out). Idempotent. */
  hydrate: () => Promise<void>
  /** Re-reads from IndexedDB even when already hydrated. */
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
  /**
   * Fills the cache from the server of record, without writing back.
   *
   * The counterpart to `entityStore.adopt`, and it exists for the same reason:
   * `ShelfSync` pulls the account's rows down and must place them locally
   * WITHOUT that placement being mistaken for a user write and sent back up.
   *
   * Deliberately no `requireWritableBackend()`, matching `entityStore.adopt`:
   * filling the cache is not a user write, and refusing it while Disconnected
   * would make going offline lose access to a record rather than merely making
   * it read-only.
   */
  adopt: (record: T) => Promise<T>
  /**
   * Drops this browser's copy **without deleting it anywhere else** — the
   * inverse of `adopt`, as `entityStore.forget` is. `ShelfSync` calls it for a
   * row the server no longer returns: the row is already gone there, and a
   * server delete would be a destructive write against whatever the server
   * does hold. No `requireWritableBackend()`, for `adopt`'s reason.
   */
  forget: (id: string) => Promise<void>
}

type SliceConfig<K extends string, T, CreateInput> = {
  /** State key holding the array — preserved per store for selector compat. */
  key: K
  /**
   * Where this collection persists: its IndexedDB store, the account's cache.
   * Writes reach it only through `requireWritableBackend()` (or `adopt`, from
   * a signed-in sync); reads go through `readableRows`, which answers nothing
   * signed out.
   */
  db: DbCollection<T, CreateInput>
  /**
   * Commit one write to the server of record, BEFORE it touches disk.
   *
   * Required: a collection with no server table would persist only on a
   * device, which `lib/db/__tests__/storeSeams.test.ts` refuses.
   *
   * Awaited and allowed to throw, matching `entityStore`'s server-first order:
   * a cache cannot legitimately be ahead of its source, so a write the server
   * refused did not happen. The alternative — fire-and-forget with a swallowed
   * warning — is the exact shape that lost an evening of play before ADR-034.
   */
  commit: (op: { kind: 'upsert'; record: T } | { kind: 'delete'; id: string }) => Promise<void>
}

type SetLike = (partial: object | ((state: never) => object)) => void
type GetLike<S> = () => S

/** Build the shared slice. Spread the result into the store's create() callback. */
export function makeHydratedCollectionSlice<
  K extends string,
  T extends { id: string },
  CreateInput,
>(config: SliceConfig<K, T, CreateInput>) {
  const { key, db, commit } = config

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
        const loaded = await readableRows(db)
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

      async adopt(record) {
        const cached = await db.put(record)
        set({
          [key]: (() => {
            const list = records()
            const exists = list.some(
              (r) => (r as { id: string }).id === (cached as { id: string }).id
            )
            return exists
              ? list.map((r) =>
                  (r as { id: string }).id === (cached as { id: string }).id ? cached : r
                )
              : [cached, ...list]
          })(),
        })
        return cached
      },

      async forget(id) {
        await db.delete(id)
        set({ [key]: records().filter((r) => r.id !== id) })
      },

      async create(input) {
        requireWritableBackend()
        // Server first. `prepareCreate` is not available on this seam, so the
        // record is built locally and committed before it is announced — the
        // ordering that matters (nothing local survives a refusal) still holds,
        // because a throw here aborts before `set`.
        const record = await db.create(input)
        try {
          await commit({ kind: 'upsert', record })
        } catch (err) {
          // The local row already landed, so undo it rather than leave the
          // cache ahead of the server — the one state ADR-034 forbids.
          // If the undo itself fails, that forbidden state is exactly what is
          // left behind — so it is reported, not swallowed. The commit error
          // is still what the caller sees.
          await db.delete((record as { id: string }).id).catch((undoErr: unknown) => {
            captureException(undoErr, { source: 'makeHydratedCollection.undoCreate', key })
          })
          throw err
        }
        set({ [key]: [record, ...records()] })
        return record
      },

      async update(id, patch) {
        requireWritableBackend()
        const updated = await db.update(id, patch)
        await commit({ kind: 'upsert', record: updated })
        set({ [key]: records().map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      async delete(id) {
        requireWritableBackend()
        // Committed BEFORE the local delete, like `entityStore.delete`: once the
        // row is gone there is nothing left to address it by.
        await commit({ kind: 'delete', id })
        await db.delete(id)
        set({ [key]: records().filter((r) => r.id !== id) })
      },
    }
  }
}
