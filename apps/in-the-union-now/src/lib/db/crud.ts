import type { IDBPDatabase } from 'idb'
import type { ZodSchema } from 'zod'

/**
 * Minimal shape every entity managed by the CRUD wrapper must have.
 */
export type EntityBase = {
  id: string
  createdAt: string
}

export type EntityStore<T extends EntityBase> = {
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
   * Merges patch into the existing record, bumps updatedAt when the schema
   * includes it, validates merged result, writes to IDB.
   * Throws if id not found.
   */
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T>
  /** Deletes by id. Silent no-op if id not found. */
  delete: (id: string) => Promise<void>
}

/**
 * Creates a typed CRUD store accessor backed by an IndexedDB object store.
 *
 * @param getDb - Lazy accessor for the opened IDBPDatabase instance.
 * @param schema - Zod schema for the entity type T. Used for validation on
 *   every read and write path.
 * @param storeName - Name of the IDB object store (keyPath = "id").
 * @param hasUpdatedAt - Set true when T includes an `updatedAt` field. Controls
 *   whether create/update inject the timestamp. Defaults to false so Workspace
 *   and SoftLink (which have no updatedAt) work without schema rejection.
 *
 * Validation: every write calls schema.parse() before db.put(). Every read
 * calls schema.parse(); schema-drift failures throw a descriptive error rather
 * than returning invalid data.
 *
 * UUID: crypto.randomUUID() — no external dependency.
 */
export function makeStore<T extends EntityBase>(
  getDb: () => Promise<IDBPDatabase>,
  schema: ZodSchema<T>,
  storeName: string,
  hasUpdatedAt = false
): EntityStore<T> {
  async function list(): Promise<T[]> {
    const db = await getDb()
    const all = await db.getAll(storeName)
    return (all as unknown[])
      .map((raw) => {
        try {
          return schema.parse(raw)
        } catch (err) {
          throw new Error(
            `[itun-db] Schema validation failed reading store "${storeName}": ${String(err)}`,
            { cause: err }
          )
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async function get(id: string): Promise<T | null> {
    const db = await getDb()
    const raw = await db.get(storeName, id)
    if (raw === undefined) return null
    try {
      return schema.parse(raw)
    } catch (err) {
      throw new Error(
        `[itun-db] Schema validation failed reading "${storeName}" id="${id}": ${String(err)}`,
        { cause: err }
      )
    }
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

  async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T> {
    const db = await getDb()
    const existing = await db.get(storeName, id)
    if (existing === undefined) {
      throw new Error(`[itun-db] Cannot update: record id="${id}" not found in "${storeName}"`)
    }
    const now = new Date().toISOString()
    const candidate: Record<string, unknown> = {
      ...(existing as Record<string, unknown>),
      ...patch,
      id, // id is immutable
    }
    if (hasUpdatedAt) {
      candidate['updatedAt'] = now
    }
    const record = schema.parse(candidate)
    await db.put(storeName, record)
    return record
  }

  async function del(id: string): Promise<void> {
    const db = await getDb()
    const existing = await db.get(storeName, id)
    if (existing === undefined) return // silent no-op
    await db.delete(storeName, id)
  }

  return { list, get, create, update, delete: del }
}
