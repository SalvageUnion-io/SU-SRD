import { useEffect, useState } from 'react'
import { askFloor } from '../account/accountApi'
import { reloadOntoNewBuild, serverBootsAnotherBuild } from '../sw/register'
import { BUILD_FLOOR } from './buildFloorStamp'

/**
 * The build floor: the one ask that retires stale tabs.
 *
 * The floor is a number in `buildFloorStamp.ts`. It is compiled into both
 * the Worker (`ACCOUNT_PATHS.floor`) and this bundle, and it is raised by hand, only
 * when a change breaks a tab that is already open. A tab whose bundle carries a
 * lower floor than the backend's was built before a change it cannot survive:
 * it may call a function that no longer exists, or send a shape that is now
 * refused. So:
 *
 * 1. **Writes stop at once.** `SyncProvider` reports `outdated`, so
 *    `canWrite` is false and the store refuses with the `outdated` reason.
 * 2. **The tab reloads once the Worker serves another build.** A floor read
 *    mid-deploy can come from a Worker version beside an older shell, so
 *    reloading the moment the floor moves could boot the same old shell — and,
 *    being outdated again, reload again. Instead it asks the Worker which shell it serves
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

/** How often a tab asks the Worker for the floor, besides whenever it is focused. */
const FLOOR_POLL_MS = 5 * 60_000

/**
 * The backend's floor: the Worker serves it and ships with
 * it, so a floor that rose is already the new build's, asked on focus and
 * every `FLOOR_POLL_MS`. One it cannot reach answers nothing.
 */
function useFloor(): number | undefined {
  const [floor, setFloor] = useState<number | undefined>(undefined)
  useEffect(() => {
    let live = true
    const check = () =>
      void askFloor().then((answer) => {
        if (live && answer !== undefined) setFloor(answer)
      })
    check()
    const timer = setInterval(check, FLOOR_POLL_MS)
    window.addEventListener('focus', check)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])
  return floor
}

/**
 * Whether this tab is below the backend's build floor, and, while it is, works
 * toward a reload. `SyncProvider` is the one caller.
 *
 * It runs in `SyncProvider`, at the root, where a throw would blank the whole
 * app, so a floor it cannot read refuses nothing.
 */
export function useBuildFloor(): boolean {
  const outdated = isOutdated(useFloor(), BUILD_FLOOR)

  useEffect(() => {
    if (!outdated) return
    return reloadOnceServed(
      () => serverBootsAnotherBuild(),
      () => void reloadOntoNewBuild()
    )
  }, [outdated])

  return outdated
}
