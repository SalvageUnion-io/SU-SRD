/**
 * Change Log (provenance) store accessor — the per-entity, append-only audit
 * trail ([ADR-022](../../../../../docs/adrs/ADR-022-provenance-log-and-overrides.md)).
 *
 * Unlike the entity stores (`makeStore` in ./crud.ts, keyed by `id` and
 * merge-patched in place), the Change Log is **append-only**: entries are never
 * mutated or deleted. The object store uses an autoIncrement `seq` primary key
 * (assigned on `add`) which doubles as the total order, plus a `by-entity`
 * index for per-entity history reads. Store creation lives in the `upgrade`
 * callback of ./index.ts (v9).
 */

import type { IDBPDatabase } from 'idb'
import type { ChangeLogEntry, ChangeLogInput } from '../schemas/changeLog'
import { ChangeLogEntrySchema, ChangeLogInputSchema } from '../schemas/changeLog'
import { STORE_NAMES } from './stores'

/** Index on `entityId` for per-entity history queries. */
export const CHANGE_LOG_ENTITY_INDEX = 'by-entity'

export type ChangeLogStore = {
  /**
   * Appends one or more entries in a single readwrite transaction. Each input
   * is strict-parsed first (a malformed entry throws before any write). The
   * autoIncrement `seq` is assigned by IndexedDB on `add`; inputs omit it.
   */
  append: (entries: ChangeLogInput[]) => Promise<void>
  /** Every entry for one entity, ordered oldest→newest by `seq`. */
  listForEntity: (entityId: string) => Promise<ChangeLogEntry[]>
}

/**
 * Parse a raw row into a ChangeLogEntry, tolerating drift: an entry that fails
 * validation is dropped with a warning rather than bricking a history read
 * (mirrors the salvage read path for entity stores — see ./crud.ts).
 */
function parseEntries(rows: unknown[]): ChangeLogEntry[] {
  const out: ChangeLogEntry[] = []
  for (const row of rows) {
    const parsed = ChangeLogEntrySchema.safeParse(row)
    if (parsed.success) {
      out.push(parsed.data)
    } else {
      console.warn('[itun-db] dropping malformed change-log entry', parsed.error)
    }
  }
  return out.sort((a, b) => a.seq - b.seq)
}

export function makeChangeLogStore(getDb: () => Promise<IDBPDatabase>): ChangeLogStore {
  return {
    async append(entries) {
      if (entries.length === 0) return
      const validated = entries.map((e) => ChangeLogInputSchema.parse(e))
      const db = await getDb()
      const tx = db.transaction(STORE_NAMES.changeLog, 'readwrite')
      for (const entry of validated) {
        // No `seq` on the record → IndexedDB assigns the autoIncrement key.
        await tx.store.add(entry)
      }
      await tx.done
    },

    async listForEntity(entityId) {
      const db = await getDb()
      const rows = await db.getAllFromIndex(
        STORE_NAMES.changeLog,
        CHANGE_LOG_ENTITY_INDEX,
        entityId
      )
      return parseEntries(rows)
    },
  }
}
