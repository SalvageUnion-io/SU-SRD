import { useQueries } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import { reloadOntoNewBuild, serverBootsAnotherBuild } from '../sw/register'

/**
 * The build floor: one Convex subscription that retires stale tabs.
 *
 * Every deploy writes the deployed commit's time into the backend
 * (`convex/buildFloor.ts`, by `deploy-cloudflare.yml`) and into the bundle
 * (`VITE_BUILD_STAMP`). A tab whose bundle is older than the floor was built
 * before the backend it talks to, and may call a function that no longer
 * exists — for weeks, behind a dismissible update toast, if nothing stops it.
 * So:
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
 */

/** This bundle's stamp, or null for a build with none (dev, CI, e2e). */
export function bundleStamp(
  raw: string | undefined = import.meta.env.VITE_BUILD_STAMP
): number | null {
  const stamp = Number(raw)
  return raw !== undefined && raw !== '' && Number.isFinite(stamp) && stamp > 0 ? stamp : null
}

/**
 * Is a bundle with this stamp older than the floor? An unstamped bundle never
 * is: it claims no age, and refusing it would fail closed on every build that
 * forgot the stamp. A floor still loading (`undefined`) is not a refusal either.
 */
export function isOutdated(floor: number | undefined, stamp: number | null): boolean {
  return stamp !== null && floor !== undefined && floor > stamp
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

const STAMP = bundleStamp()

/** Module-level, so the subscription's request is the same object every render. */
const FLOOR_REQUEST = { floor: { query: api.build.floor, args: {} } }

/**
 * Subscribes to the floor and, while this bundle is below it, works toward a
 * reload. Returns whether this tab is outdated.
 *
 * `useQueries` rather than `useQuery` because it hands back a failed query as
 * an `Error` instead of throwing it: this runs in `ConnectionProvider`, at the
 * root, where a throw would blank the whole app. A floor it cannot read
 * refuses nothing.
 */
function useStampedBuildFloor(stamp: number): boolean {
  const result: unknown = useQueries(FLOOR_REQUEST).floor
  const outdated = isOutdated(typeof result === 'number' ? result : undefined, stamp)

  useEffect(() => {
    if (!outdated) return
    return reloadOnceServed(
      () => serverBootsAnotherBuild(),
      () => void reloadOntoNewBuild()
    )
  }, [outdated])

  return outdated
}

/**
 * Whether this tab is below the build floor. `ConnectionProvider` is the one
 * caller.
 *
 * Chosen once, at module load, from a build-time constant, so a given bundle
 * always calls the same hooks: an unstamped bundle can never be outdated and
 * never subscribes.
 */
export const useBuildFloor: () => boolean =
  STAMP === null ? () => false : () => useStampedBuildFloor(STAMP)
