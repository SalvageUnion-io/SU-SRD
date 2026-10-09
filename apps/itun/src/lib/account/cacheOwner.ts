/**
 * The cache belongs to one account at a time.
 *
 * IndexedDB holds a copy of one account's Convex rows, and the meta row
 * (`db/cacheMeta.ts`) records whose. The two moments the owner can change act
 * on it:
 *
 *  - **sign-out** (`forgetCache`): the cache goes with the session;
 *  - **a signed-in boot** (`claimCacheFor`): rows recorded as another
 *    account's, or as nobody's, are dropped before anything reads them, and
 *    `ShelfSync` refills the cache from the server.
 */

import { useEncounterStore } from '../../stores/encounterStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { forgetVersions } from '../../stores/serverVersions'
import { clearCache, readCacheMeta } from '../db/index'

/**
 * Empty the cache for `userId`, and everything that was reading it.
 *
 * The in-memory stores are reloaded from the now-empty database rather than
 * set to `[]` directly, so each one goes through its own read rule. Other tabs
 * drop their own copies when they see the session end (`forgetLoadedRows`).
 */
async function emptyFor(userId: string | null): Promise<void> {
  await clearCache(userId)
  forgetVersions()
  const entities = useEntityStore.getState()
  await Promise.all([
    entities.rehydrate('pilot'),
    entities.rehydrate('mech'),
    entities.rehydrate('crawler'),
    entities.rehydrate('softLink'),
    usePatternStore.getState().rehydrate(),
    useEncounterStore.getState().rehydrate(),
  ])
}

/**
 * Drop this tab's loaded rows when its session ends, leaving IndexedDB alone.
 *
 * The auth layer ends the session in every open tab, and each tab calls this
 * for itself (`AccountReconciler`); only the tab that signed out empties the
 * shared database (`forgetCache`). Without it, a tab that did not sign out
 * would keep showing the last account's rows, and carry them into the next
 * account's session. The stores stay hydrated and empty, which is what a
 * signed-out read answers anyway (`readableRows`), and the adopted versions
 * are forgotten so the next sign-in's `ShelfSync` adopts every row afresh.
 */
export function forgetLoadedRows(): void {
  forgetVersions()
  useEntityStore.setState({
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: true, mechs: true, crawlers: true, softLinks: true },
  })
  usePatternStore.setState({ mechPatterns: [], hydrated: true })
  useEncounterStore.setState({ encounterNpcs: [], hydrated: true })
}

/** Make the cache `userId`'s before anything syncs into it. */
export async function claimCacheFor(userId: string): Promise<void> {
  const meta = await readCacheMeta()
  if (meta.userId === userId) return
  await emptyFor(userId)
}

/** Drop the signed-out account's rows. */
export async function forgetCache(): Promise<void> {
  await emptyFor(null)
}
