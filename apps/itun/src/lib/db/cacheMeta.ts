/**
 * Where this browser's rows came from, and whose they are (v18).
 *
 * IndexedDB is a cache of one account's Convex rows
 * ([ADR-034](../../../../../docs/ARCHITECTURE.md#adr-034)). A cache that can
 * hold two accounts' rows, or that cannot tell its own rows from a pre-account
 * roster, is not one. Two facts settle both, and they live in one row:
 *
 *  - **`origin`** — `legacy` when the rows predate accounts and may not be in
 *    any account yet (ADR-035), `cache` when every row came from the server or
 *    from a write it accepted first. Only the v18 upgrade writes `legacy`, and
 *    only for a database that already held a roster; a completed migration
 *    flips it to `cache`, for good.
 *  - **`userId`** — the account the cached rows belong to, or `null` when they
 *    belong to nobody yet.
 *
 * Before this row the first fact was a probe that counted rows at boot and kept
 * its verdict in module memory. A signed-in browser's cache is full of rows, so
 * every load probed `present`, re-ran the migration, and re-claimed any cached
 * build that had since been deleted on another device. The second fact did not
 * exist at all, so a second account on the same browser was offered the first
 * account's rows as its own.
 */

import type { UpgradeTransaction } from './migrations/types'
import { STORE_NAMES } from './stores'

export type CacheOrigin = 'legacy' | 'cache'

export type CacheMeta = { origin: CacheOrigin; userId: string | null }

/** The one row's key. The store is keyed by `id` like every other. */
export const CACHE_META_ID = 'cache'

/** What a database with no meta row means: a cache that belongs to nobody. */
export const EMPTY_CACHE_META: CacheMeta = { origin: 'cache', userId: null }

/**
 * The stores whose contents mean "this browser holds a pre-account roster".
 *
 * Only the ones a *person* built. `workspaces` is the retired container, so it
 * does not make a browser `legacy` on its own, and neither does the device-only
 * `changeLog` a pre-v18 database still holds. `softLinks` is out for the same reason:
 * a link is wiring between things rather than a thing, and a browser holding
 * only orphaned links has nothing to migrate.
 */
const ROSTER_STORES = [
  STORE_NAMES.pilots,
  STORE_NAMES.mechs,
  STORE_NAMES.crawlers,
  STORE_NAMES.mechPatterns,
  STORE_NAMES.encounterNpcs,
] as const

/** The stored row, or the empty answer for a missing or unreadable one. */
export function parseCacheMeta(row: unknown): CacheMeta {
  if (typeof row !== 'object' || row === null) return EMPTY_CACHE_META
  const { origin, userId } = row as { origin?: unknown; userId?: unknown }
  return {
    origin: origin === 'legacy' ? 'legacy' : 'cache',
    userId: typeof userId === 'string' ? userId : null,
  }
}

/** The row as it is stored. */
export function cacheMetaRecord(meta: CacheMeta): CacheMeta & { id: string } {
  return { id: CACHE_META_ID, origin: meta.origin, userId: meta.userId }
}

/**
 * Write the first meta row, inside the v18 upgrade.
 *
 * `legacy` only for a database that existed before v18 (`oldVersion` 1–17) and
 * holds a roster. That is the one population that may hold rows no account
 * has: a fresh database holds nothing, and every database opened at v18 or
 * later records its origin as it goes. Counts rather than reads, and only on
 * the upgrade transaction, so the versionchange transaction stays open.
 */
export async function writeInitialCacheMeta(
  tx: UpgradeTransaction,
  oldVersion: number
): Promise<void> {
  let origin: CacheOrigin = 'cache'
  if (oldVersion >= 1) {
    for (const store of ROSTER_STORES) {
      if ((await tx.objectStore(store).count()) > 0) {
        origin = 'legacy'
        break
      }
    }
  }
  await tx.objectStore(STORE_NAMES.meta).put(cacheMetaRecord({ origin, userId: null }))
}
