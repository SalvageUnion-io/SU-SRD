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

  async function create(input: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const db = await getDb()
    const now = new Date().toISOString()
    const candidate: Record<string, unknown> = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
    }
    if (hasUpdatedAt) {
      candidate['updatedAt'] = now
    }
    // parse() throws ZodError on bad input — let it bubble to caller
    const record = schema.parse(candidate)
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
      ...(existing as Record<string, unknown>),
      ...patch,
      id, // id is immutable
    }
    if (hasUpdatedAt) {
      candidate['updatedAt'] = now
    }
    return schema.parse(candidate)
  }

  async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const db = await getDb()
    const record = await prepareUpdate(id, patch)
    await db.put(storeName, record)
    return record
  }

  async function del(id: string): Promise<void> {
    const db = await getDb()
    const existing = await db.get(storeName, id)
    if (existing === undefined) return // silent no-op
    await db.delete(storeName, id)
  }

  return { list, get, create, update, prepareUpdate, delete: del }
}
