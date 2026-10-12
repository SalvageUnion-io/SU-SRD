/**
 * D9 spike — an in-memory stand-in for the IndexedDB cache.
 *
 * PROTOTYPE ONLY, used when `convexDirectEnabled()` is on. It implements the
 * slice of `IDBPDatabase` that `crud.ts` and `index.ts` call (get, getAll, put,
 * delete and a readwrite transaction over object stores) on plain Maps, so the
 * stores, `ShelfSync` and every write path run unchanged while nothing
 * survives the page. The rows come from Convex on each load, which is the
 * behaviour the spike measures.
 */

import type { IDBPDatabase } from 'idb'

type Row = { id: string }

function makeObjectStore(rows: Map<string, Row>) {
  return {
    async get(id: string) {
      return rows.get(id)
    },
    async getAll() {
      return [...rows.values()]
    },
    async put(record: Row) {
      rows.set(record.id, structuredClone(record))
      return record.id
    },
    async delete(id: string) {
      rows.delete(id)
    },
    async clear() {
      rows.clear()
    },
  }
}

/** A fresh, empty in-memory database with one Map per store name. */
export function openMemoryDatabase(storeNames: readonly string[]): IDBPDatabase {
  const stores = new Map(storeNames.map((name) => [name, new Map<string, Row>()]))
  const storeFor = (name: string) => {
    const rows = stores.get(name)
    if (!rows) throw new Error(`[itun-db] memory: no store "${name}"`)
    return makeObjectStore(rows)
  }
  const db = {
    get: (name: string, id: string) => storeFor(name).get(id),
    getAll: (name: string) => storeFor(name).getAll(),
    put: (name: string, record: Row) => storeFor(name).put(record),
    delete: (name: string, id: string) => storeFor(name).delete(id),
    // Not atomic: a spike-only shortcut. Every op here is a synchronous Map
    // write behind a promise, so nothing interleaves inside one transaction.
    transaction: (_names: string | string[]) => ({
      objectStore: storeFor,
      done: Promise.resolve(),
    }),
    close() {
      // Nothing to release.
    },
  }
  // The structural subset above is all the db layer touches; the full idb type
  // carries dozens of members the cache never calls.
  return db as unknown as IDBPDatabase
}
