/**
 * D9 spike flag — run ITUN with no device cache (docs/spikes/d9-offline-cache.md).
 *
 * PROTOTYPE ONLY, default off. On, the app keeps no copy of player data on the
 * device: the IndexedDB cache is replaced by an in-memory one that starts
 * empty on every load (`lib/db/memoryDb.ts`), so the stores hold only what the
 * Convex subscriptions (`ShelfSync`, `WiringSync`) have delivered this page
 * load, and no service worker is registered (an existing one is unregistered).
 *
 * Turn it on per browser with `localStorage.setItem('itun:convex-direct', '1')`
 * and a reload, or per build with `VITE_ITUN_CONVEX_DIRECT=1`.
 */

const STORAGE_KEY = 'itun:convex-direct'

function readFlag(): boolean {
  if (import.meta.env.VITE_ITUN_CONVEX_DIRECT === '1') return true
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage can throw (blocked site data, some private windows): the flag is
    // a spike convenience, so unreadable means off.
    return false
  }
}

/** Read once per page load: the cache backend cannot change under a live page. */
const enabled = readFlag()

export function convexDirectEnabled(): boolean {
  return enabled
}
