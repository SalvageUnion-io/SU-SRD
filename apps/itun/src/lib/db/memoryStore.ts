/**
 * memoryStore — the same CRUD contract as `crud.ts`, backed by a Map that never
 * touches disk.
 *
 * This is what an **anonymous** visitor builds against under
 * [ADR-034](../../../../../docs/adrs/ADR-034-account-required-persistence.md)
 * decision 1: you can work through a wizard, roll, and see a finished sheet
 * without an account, and nothing you do is written to durable storage of any
 * kind — not Convex, and not IndexedDB. Saving is where an account is required,
 * and it is the only place.
 *
 * ## Why a second implementation rather than a flag inside `crud.ts`
 *
 * The point of this store is what it *cannot* do. A conditional inside the IDB
 * store would leave every `db.put` one wrong branch away from writing, and the
 * property being claimed here — "nothing is written" — is exactly the sort that
 * dies quietly to a missed branch. A separate object with no `idb` import at all
 * cannot regress that way: there is nothing in this file to write with.
 *
 * ## Deliberately identical where it matters, and only there
 *
 * Everything a caller can observe is the same as the IDB store: a fresh UUID and
 * `createdAt` on `create`, `updatedAt` when the schema has one, strict Zod
 * validation on every write, `list()` sorted newest-first, `update` throwing on
 * a missing id, `delete` a silent no-op. `entityStore` is written against that
 * contract and must not learn which backend it has.
 *
 * Two things are deliberately *not* carried over:
 *
 *  - **No salvage-tolerant reads.** Salvage exists because a record persisted by
 *    an older or newer build can drift from the current schema. Nothing here
 *    outlives the tab, so every record in the Map was written by this exact
 *    build, and a parse failure would be a real bug rather than version skew —
 *    it should throw where it happens, not be repaired into a warning.
 *  - **No cross-tab broadcast.** Two tabs of an anonymous session are two
 *    sessions: there is nothing durable tying them together, and syncing them
 *    would invent precisely the device-local shared state ADR-034 forbids. The
 *    caller is responsible for not broadcasting — see `entityStore`.
 */

import type { z } from 'salvageunion-reference/zod'

/** The minimum every record managed here must have. Mirrors `crud.ts`. */
type EntityBase = {
  id: string
  createdAt: string
}

/**
 * The CRUD surface, structurally identical to `crud.ts`'s `EntityStore<T>`.
 *
 * Declared here rather than imported because `crud.ts` does not export it, and
 * exporting it purely to share it with this file would widen that module's
 * public surface for no other consumer. The two are kept in step by
 * `dbStoreFor` accepting both — a drift between them is a type error at that
 * call site, which is the check that matters.
 */
export type MemoryEntityStore<T extends EntityBase> = {
  list: () => Promise<T[]>
  get: (id: string) => Promise<T | null>
  create: (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<T>
  prepareUpdate: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>
  put: (record: T) => Promise<T>
  delete: (id: string) => Promise<void>
}

type MakeMemoryStoreOptions = {
  /** Set when T carries `updatedAt`. Mirrors `makeStore`'s option of the same name. */
  hasUpdatedAt?: boolean
}

/**
 * Build an in-memory store for one entity type.
 *
 * The `Map` is closed over rather than module-global, so each store owns its own
 * rows and a test can build a fresh one without a reset hook.
 */
export function makeMemoryStore<T extends EntityBase>(
  schema: z.ZodType<T>,
  storeName: string,
  options: MakeMemoryStoreOptions = {}
): MemoryEntityStore<T> {
  const { hasUpdatedAt = false } = options
  const rows = new Map<string, T>()

  async function list(): Promise<T[]> {
    // Sorted newest-first, like the IDB store — surfaces read this order and a
    // difference here would show up as a roster that reorders on sign-out.
    return [...rows.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  async function get(id: string): Promise<T | null> {
    return rows.get(id) ?? null
  }

  async function create(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const candidate: Record<string, unknown> = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    if (hasUpdatedAt) candidate.updatedAt = now

    // `parse`, not `safeParse` — a ZodError bubbling to the caller is the same
    // contract the IDB store has, and wizards rely on it to surface a bad build.
    const record = schema.parse(candidate)
    rows.set(record.id, record)
    return record
  }

  async function prepareUpdate(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const existing = rows.get(id)
    if (existing === undefined) {
      throw new Error(`[itun-memory] Cannot update: record id="${id}" not found in "${storeName}"`)
    }
    const candidate: Record<string, unknown> = {
      ...existing,
      ...patch,
      id, // immutable, exactly as in the IDB store
    }
    if (hasUpdatedAt) candidate.updatedAt = new Date().toISOString()
    return schema.parse(candidate)
  }

  async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const record = await prepareUpdate(id, patch)
    rows.set(id, record)
    return record
  }

  /**
   * Keep a record that arrived with its own id.
   *
   * Reachable here mainly through `entityStore.adopt`. It stays strict rather
   * than salvage-tolerant for the reason in the header: nothing in this Map
   * outlived a build, so there is no version skew for salvage to absorb.
   */
  async function put(record: T): Promise<T> {
    const parsed = schema.parse(record)
    rows.set(parsed.id, parsed)
    return parsed
  }

  async function del(id: string): Promise<void> {
    rows.delete(id) // silent no-op when absent, like the IDB store
  }

  return { list, get, create, update, prepareUpdate, put, delete: del }
}
