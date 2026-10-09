/**
 * Whose rows this browser's cache holds.
 *
 * IndexedDB is a cache of one account's Convex rows
 * ([ADR-034](../../../../../docs/ARCHITECTURE.md#adr-034)). A cache that can
 * hold two accounts' rows is not one, so one row records the owner:
 * **`userId`**, the account the cached rows belong to, or `null` when they
 * belong to nobody yet (a fresh or just-emptied database).
 *
 * `lib/account/cacheOwner.ts` acts on it: a signed-in boot whose account
 * differs empties the cache before anything reads it, and sign-out empties it.
 */

export type CacheMeta = { userId: string | null }

/** The one row's key. The store is keyed by `id` like every other. */
export const CACHE_META_ID = 'cache'

/** What a database with no meta row means: a cache that belongs to nobody. */
const EMPTY_CACHE_META: CacheMeta = { userId: null }

/** The stored row, or the empty answer for a missing or unreadable one. */
export function parseCacheMeta(row: unknown): CacheMeta {
  if (typeof row !== 'object' || row === null) return EMPTY_CACHE_META
  const { userId } = row as { userId?: unknown }
  return { userId: typeof userId === 'string' ? userId : null }
}

/** The row as it is stored. */
export function cacheMetaRecord(meta: CacheMeta): CacheMeta & { id: string } {
  return { id: CACHE_META_ID, userId: meta.userId }
}
