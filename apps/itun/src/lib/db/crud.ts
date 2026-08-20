import type { IDBPDatabase } from 'idb'
import type { z } from 'salvageunion-reference/zod'

/**
 * Minimal shape every entity managed by the CRUD wrapper must have.
 */
type EntityBase = {
  id: string
  createdAt: string
}

type EntityStore<T extends EntityBase> = {
  /** Returns all records sorted newest-first by createdAt. */
  list: () => Promise<T[]>
  /** Returns the record or null when id is not found. */
  get: (id: string) => Promise<T | null>
  /**
   * Assigns a UUID, stamps createdAt (and updatedAt when the schema includes it),
   * validates with the Zod schema, writes to IDB.
   */
  create: (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<T>
  /**
   * create() minus the write: mint the id, stamp the timestamps and
   * strict-parse, returning the record that create() *would* have written.
   *
   * The counterpart to `prepareUpdate`, and it exists for the same reason one
   * phase later: once Convex is the source of truth, a record has to be built
   * and accepted by the server BEFORE anything local is touched, so that a
   * refused write leaves no trace on the device. Without this split the id and
   * timestamps only came into existence as a side effect of persisting.
   */
  prepareCreate: (input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => Promise<T>
  /**
   * update() minus the write: merge + stamp + strict-parse, returning the
   * validated record. Feed the result to an atomicWrite() transaction.
   */
  prepareUpdate: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>
  /**
   * Merges patch into the existing record, bumps updatedAt when the schema
   * includes it, validates merged result, writes to IDB.
   * Throws if id not found.
   */
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>
  /**
   * Writes a record the app did not mint, under the id it already carries.
   * The cache-fill path for rows pulled from the server of record — see the
   * implementation for why this is not `create` or `update`.
   */
  put: (record: T) => Promise<T>
  /** Deletes by id. Silent no-op if id not found. */
  delete: (id: string) => Promise<void>
}

type MakeStoreOptions<T extends EntityBase> = {
  /**
   * Set true when T includes an `updatedAt` field. Controls whether
   * create/update inject the timestamp.
   */
  hasUpdatedAt?: boolean
  /**
   * Salvage-path schema for READS (plan 2.1): typically the same object shape
   * with `.strip()` instead of `.strict()`, so records that drifted (e.g. an
   * old field a newer build no longer knows, or a field written by a newer
   * build under PWA autoUpdate version skew) are stripped/defaulted with a
   * console warning instead of bricking the whole store hydration.
   * Writes always validate against the strict `schema`.
   */
  salvageSchema?: z.ZodType<T>
}

/**
 * Creates a typed CRUD store accessor backed by an IndexedDB object store.
 *
 * @param getDb - Lazy accessor for the opened IDBPDatabase instance.
 * @param schema - Zod schema for the entity type T. Used for validation on
 *   every write path and as the first attempt on reads.
 * @param storeName - Name of the IDB object store (keyPath = "id").
 * @param options - hasUpdatedAt + optional salvage schema (see MakeStoreOptions).
 *
 * Read validation order: strict parse → salvage parse (warn) → skip the
 * record entirely (warn). A single drifted record can therefore never brick
 * hydration of its store; it is healed on its next write (update re-parses
 * the salvaged shape strictly before putting).
 *
 * UUID: crypto.randomUUID() — no external dependency.
 */
export function makeStore<T extends EntityBase>(
  getDb: () => Promise<IDBPDatabase>,
  schema: z.ZodType<T>,
  storeName: string,
  options: MakeStoreOptions<T> = {}
): EntityStore<T> {
  const { hasUpdatedAt = false, salvageSchema } = options

  /**
   * Parse a raw record for the read path. Returns null when the record cannot
   * be made valid even by the salvage schema — callers skip it (list) or
   * report it missing (get) rather than throwing.
   */
  function salvageRead(raw: unknown, context: string): T | null {
    const strict = schema.safeParse(raw)
    if (strict.success) return strict.data

    if (salvageSchema) {
      const salvaged = salvageSchema.safeParse(raw)
      if (salvaged.success) {
        console.warn(
          `[itun-db] Record in "${storeName}" (${context}) did not match the strict schema; ` +
            `loaded via salvage path (unknown fields stripped, defaults applied). ` +
            `Original error: ${strict.error.message}`
        )
        return salvaged.data
      }
    }

    console.warn(
      `[itun-db] Skipping unreadable record in "${storeName}" (${context}): ${strict.error.message}`
    )
    return null
  }

  async function list(): Promise<T[]> {
    const db = await getDb()
    const all = await db.getAll(storeName)
    return (all as unknown[])
      .map((raw, i) => salvageRead(raw, `index ${i}`))
      .filter((record): record is T => record !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async function get(id: string): Promise<T | null> {
    const db = await getDb()
    const raw = await db.get(storeName, id)
    if (raw === undefined) return null
    return salvageRead(raw, `id="${id}"`)
  }

  /**
   * Everything `create` does except the write.
   *
   * Split out so a caller can obtain the finished record — id minted,
   * timestamps stamped, strict-parsed — and decide separately whether to
   * persist it. `create` is now this plus one `put`, so the two cannot drift.
   */
  async function prepareCreate(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const candidate: Record<string, unknown> = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    if (hasUpdatedAt) {
      candidate.updatedAt = now
    }
    // parse() throws ZodError on bad input — let it bubble to caller
    return schema.parse(candidate)
  }

  async function create(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const db = await getDb()
    const record = await prepareCreate(input)
    await db.put(storeName, record)
    return record
  }

  /**
   * Everything update() does EXCEPT the write: read the current record,
   * merge the patch, stamp updatedAt, and strict-parse. Used by the
   * multi-entity atomic transfer path, which validates every record first
   * and then commits all writes in one IDB transaction.
   */
  async function prepareUpdate(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const db = await getDb()
    const raw = await db.get(storeName, id)
    if (raw === undefined) {
      throw new Error(`[itun-db] Cannot update: record id="${id}" not found in "${storeName}"`)
    }
    // Base the merge on the salvaged read so a drifted record heals on its
    // next write instead of failing the strict parse below forever.
    const existing = salvageRead(raw, `id="${id}"`) ?? (raw as Record<string, unknown>)
    const now = new Date().toISOString()
    const candidate: Record<string, unknown> = {
      ...existing,
      ...patch,
      id, // id is immutable
    }
    if (hasUpdatedAt) {
      candidate.updatedAt = now
    }
    return schema.parse(candidate)
  }

  async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const db = await getDb()
    const record = await prepareUpdate(id, patch)
    await db.put(storeName, record)
    return record
  }

  /**
   * Cache a record that arrived from somewhere else, keeping its id.
   *
   * Neither `create` nor `update` can do this, and the reasons are the whole
   * point of having a third verb:
   *
   *  - `create` mints a fresh UUID. A server row cached under a new id is a
   *    *copy*, so the next edit would mirror back addressed by an appId the
   *    server has never seen and land as a second entity.
   *  - `update` requires the row to exist locally, which by definition it does
   *    not the first time a Game's crawler or a claimed pre-gen is pulled down.
   *
   * Reads are salvage-tolerant everywhere else in this module, and adoption is
   * a read that happens to persist: a Game row written by a newer build than
   * this one must still be openable, so a strict-parse failure falls back to
   * the salvage shape rather than refusing the whole entity.
   */
  async function put(record: T): Promise<T> {
    const db = await getDb()
    const strict = schema.safeParse(record)
    const parsed = strict.success ? strict.data : salvageRead(record, `id="${record.id}"`)
    if (parsed === null) {
      throw new Error(
        `[itun-db] Cannot cache record id="${record.id}" in "${storeName}": it does not parse`
      )
    }
    await db.put(storeName, parsed)
    return parsed
  }

  async function del(id: string): Promise<void> {
    const db = await getDb()
    const existing = await db.get(storeName, id)
    if (existing === undefined) return // silent no-op
    await db.delete(storeName, id)
  }

  return { list, get, create, prepareCreate, update, prepareUpdate, put, delete: del }
}
