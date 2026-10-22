/**
 * makeHydratedCollection — the shared skeleton behind every single-collection
 * Zustand store.
 *
 * encounterStore and patternStore both follow the same discipline: rows held
 * in memory, arriving from the server of record (`ShelfSync`; `hydrate()`
 * waits for them, `rowArrival.ts`), and server-first writes (server, then
 * in-memory set(); ADR-034). Another tab's writes arrive through this tab's
 * own Convex subscription: `ShelfSync` adopts its creates and edits and
 * forgets its deletes. There is no tab-to-tab channel; the device copy is read only offline (ADR-058).
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

import { requireWritableBackend } from './entityBackend'
import type { RecordKind } from './records'
import { parseServed, prepareCreate, prepareUpdate, upsertById } from './records'
import { untilRowsArrive } from './rowArrival'

/** The CRUD + hydration surface every collection store shares. */
export type HydratedCollectionSlice<K extends string, T> = Record<K, T[]> & {
  /** Whether the server's rows have arrived (or none are coming). */
  hydrated: boolean
  /** Resolves once the rows have arrived (`rowArrival.ts`). Idempotent. */
  hydrate: () => Promise<void>
  /** `ShelfSync`: the first answer is in. */
  markArrived: () => void
  /** Sync list — returns in-memory records. Auto-triggers hydrate if needed. */
  list: () => T[]
  /** Sync get by id or null. */
  get: (id: string) => T | null
}

export type HydratedCollectionActions<T, CreateInput> = {
  /** Commits to the server, then prepends to in-memory state. Zod errors propagate. */
  create: (input: CreateInput) => Promise<T>
  /** Merges patch, commits it, updates in-memory state. */
  update: (id: string, patch: Partial<T>) => Promise<T>
  /** Deletes on the server, then from in-memory state. */
  delete: (id: string) => Promise<void>
  /**
   * Holds a row from the server of record, without writing back.
   *
   * The counterpart to `entityStore.adopt`, and it exists for the same reason:
   * `ShelfSync` brings the account's rows down and must place them locally
   * WITHOUT that placement being mistaken for a user write and sent back up.
   * Deliberately no `requireWritableBackend()`, matching `entityStore.adopt`.
   */
  adopt: (record: T) => Promise<T>
  /**
   * Drops this tab's copy **without deleting it anywhere else** — the
   * inverse of `adopt`, as `entityStore.forget` is. `ShelfSync` calls it for a
   * row the server no longer returns: the row is already gone there, and a
   * server delete would be a destructive write against whatever the server
   * does hold.
   */
  forget: (id: string) => Promise<void>
}

type SliceConfig<K extends string, T> = {
  /** State key holding the array — preserved per store for selector compat. */
  key: K
  /** The record's schema; every create, update and adopted row parses against it. */
  kind: RecordKind<T>
  /**
   * Commit one write to the server of record, BEFORE the store changes.
   *
   * Required: a collection with no server table would hold rows nowhere but
   * one tab's memory.
   *
   * Awaited and allowed to throw, matching `entityStore`'s server-first order:
   * the store cannot legitimately be ahead of its source, so a write the server
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
>(config: SliceConfig<K, T>) {
  const { key, kind, commit } = config

  return function slice(
    set: SetLike,
    get: GetLike<HydratedCollectionSlice<K, T>>,
    subscribe: (listener: () => void) => () => void
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
        await untilRowsArrive(() => get().hydrated, subscribe)
        if (!get().hydrated) set({ hydrated: true })
      },

      markArrived() {
        if (!get().hydrated) set({ hydrated: true })
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
        const held = parseServed(kind, record)
        set({ [key]: upsertById(records(), held) })
        return held
      },

      async forget(id) {
        set({ [key]: records().filter((r) => r.id !== id) })
      },

      async create(input) {
        requireWritableBackend()
        // Server first: build the record, commit it, and only then hold it. A
        // throw here aborts before `set`, so a refusal leaves no trace.
        const record = prepareCreate(kind, input as object)
        await commit({ kind: 'upsert', record })
        set({ [key]: [record, ...records()] })
        return record
      },

      async update(id, patch) {
        requireWritableBackend()
        const updated = prepareUpdate(kind, get().get(id), id, patch)
        await commit({ kind: 'upsert', record: updated })
        set({ [key]: records().map((r) => (r.id === id ? updated : r)) })
        return updated
      },

      async delete(id) {
        requireWritableBackend()
        await commit({ kind: 'delete', id })
        set({ [key]: records().filter((r) => r.id !== id) })
      },
    }
  }
}
