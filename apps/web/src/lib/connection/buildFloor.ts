import { useQueries } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { BUILD_FLOOR } from '../../../convex/buildFloor'
import { reloadOntoNewBuild, serverBootsAnotherBuild } from '../sw/register'

/**
 * The build floor: one Convex subscription that retires stale tabs.
 *
 * The floor is a number in `convex/buildFloor.ts`. It is compiled into both
 * the backend (`build.floor`) and this bundle, and it is raised by hand, only
 * when a change breaks a tab that is already open. A tab whose bundle carries a
 * lower floor than the backend's was built before a change it cannot survive:
 * it may call a function that no longer exists, or send a shape that is now
 * refused. So:
 *
 * 1. **Writes stop at once.** `ConnectionProvider` reports `outdated`, so
 *    `canWrite` is false and the store refuses with the `outdated` reason.
 * 2. **The tab reloads once the Worker serves another build.** The Convex push
 *    lands a minute or two before the Worker deploy, so reloading the moment
 *    the floor moves would boot the same old shell — and, being outdated
 *    again, reload again. Instead it asks the Worker which shell it serves
 *    (`serverBootsAnotherBuild`), with backoff, and reloads only when that
 *    shell is not this page's. An unreachable server answers "same", so an
 *    offline tab waits rather than loops.
 *
 * A deploy that leaves the floor alone retires no tab. Every build carries the
 * same number as the backend it ships with, so dev, CI and e2e are never
 * outdated either.
 */

/**
 * Is a bundle built with floor `stamp` older than the backend's `floor`? A
 * floor still loading (`undefined`) is not a refusal.
 */
export function isOutdated(floor: number | undefined, stamp: number): boolean {
  return floor !== undefined && floor > stamp
}

/** The first wait before asking the Worker again, doubled each time. */
export const FIRST_PROBE_MS = 5_000
/** The longest wait between two asks. */
export const MAX_PROBE_MS = 60_000

/**
 * Asks `served()` until it says yes, backing off from `FIRST_PROBE_MS` to
 * `MAX_PROBE_MS`, then calls `reload()` once. Returns a cancel.
 *
 * `served` must not reject: `serverBootsAnotherBuild` answers `false` for any
 * failure. Exported for tests, which drive `schedule` by hand.
 */
export function reloadOnceServed(
  served: () => Promise<boolean>,
  reload: () => void,
  schedule: (run: () => void, ms: number) => () => void = (run, ms) => {
    const id = setTimeout(run, ms)
    return () => clearTimeout(id)
  }
): () => void {
  let cancelled = false
  let cancelTimer: (() => void) | null = null

  const attempt = (nextDelay: number) => {
    void served().then((yes) => {
      if (cancelled) return
      if (yes) {
        reload()
        return
      }
      cancelTimer = schedule(() => attempt(Math.min(nextDelay * 2, MAX_PROBE_MS)), nextDelay)
    })
  }

  attempt(FIRST_PROBE_MS)
  return () => {
    cancelled = true
    cancelTimer?.()
  }
}

/** Module-level, so the subscription's request is the same object every render. */
const FLOOR_REQUEST = { floor: { query: api.build.floor, args: {} } }

/**
 * Whether this tab is below the backend's build floor, and, while it is, works
 * toward a reload. `ConnectionProvider` is the one caller.
 *
 * `useQueries` rather than `useQuery` because it hands back a failed query as
 * an `Error` instead of throwing it: this runs in `ConnectionProvider`, at the
 * root, where a throw would blank the whole app. A floor it cannot read
 * refuses nothing.
 */
export function useBuildFloor(): boolean {
  const result: unknown = useQueries(FLOOR_REQUEST).floor
  const outdated = isOutdated(typeof result === 'number' ? result : undefined, BUILD_FLOOR)

  useEffect(() => {
    if (!outdated) return
    return reloadOnceServed(
      () => serverBootsAnotherBuild(),
      () => void reloadOntoNewBuild()
    )
  }, [outdated])

  return outdated
}
