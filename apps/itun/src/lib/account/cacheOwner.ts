/**
 * The cache belongs to one account at a time.
 *
 * IndexedDB holds a copy of one account's Convex rows. Nothing used to say
 * whose, and nothing ever emptied it: sign-out left the rows on disk, and the
 * next account to sign in on the same browser had them read as *its* local
 * work — compared against its `listMine`, found missing, and sent to
 * `claimLocal`, which reported them as builds that "could not be moved".
 *
 * The meta row (`db/cacheMeta.ts`) now records the owner, and the two moments
 * the owner can change act on it:
 *
 *  - **sign-out** (`forgetCache`): the cache goes with the session;
 *  - **a signed-in boot** (`claimCacheFor`): rows recorded as another
 *    account's, or as nobody's, are dropped before anything reads them, and
 *    `ShelfSync` refills the cache from the server.
 *
 * Neither ever touches a **`legacy`** cache. Those rows predate accounts and
 * may be in none yet; wiping them would destroy the only copy. They stay until
 * `AccountReconciler` has migrated every one, which flips the origin to
 * `cache` — after that the browser is an ordinary cache and both rules apply.
 */

import { useEncounterStore } from '../../stores/encounterStore'
import { useEntityStore } from '../../stores/entityStore'
import { usePatternStore } from '../../stores/patternStore'
import { forgetVersions } from '../../stores/serverVersions'
import { publishStoreChange } from '../db/broadcast'
import { clearCache, readCacheMeta } from '../db/index'
import { STORE_NAMES } from '../db/stores'

/**
 * Empty the cache for `userId`, and everything that was reading it.
 *
 * The in-memory stores are reloaded from the now-empty database rather than
 * set to `[]` directly, so each one goes through its own read rule; other tabs
 * hear about it by broadcast and do the same.
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
  for (const name of Object.values(STORE_NAMES)) publishStoreChange(name)
}

/**
 * Make the cache `userId`'s before anything syncs into it.
 *
 * Once this resolves the cache is this account's, or is a `legacy` roster
 * awaiting migration, which `AccountReconciler` compares against the account
 * rather than trusting.
 */
export async function claimCacheFor(userId: string): Promise<void> {
  const meta = await readCacheMeta()
  if (meta.origin === 'legacy') return
  if (meta.userId === userId) return
  await emptyFor(userId)
}

/** Drop the signed-out account's rows, unless they are an unmigrated roster. */
export async function forgetCache(): Promise<void> {
  const meta = await readCacheMeta()
  if (meta.origin === 'legacy') return
  await emptyFor(null)
}
