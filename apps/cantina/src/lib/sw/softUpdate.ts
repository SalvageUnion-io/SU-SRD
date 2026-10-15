import type { AnyRouter, BlockerFn, RouterHistory } from '@tanstack/react-router'
import { reloadOntoNewBuild } from './register'

/**
 * Soft update: a tab moves onto a compatible new build at its next page change.
 *
 * A deploy that leaves the build floor alone (`convex/buildFloor.ts`) breaks no
 * open tab, so nothing should interrupt one: no read-only window, no reload
 * under the player's hands. Two signals still mean a new build is live:
 *
 * - **A new service worker is waiting** (`onNeedRefresh`): this tab's update
 *   check (`keepCheckingForUpdates`) installed the new build's precache.
 * - **Another tab activated it** (`onNeedReload`). `virtual:pwa-register`
 *   would reload this tab on the spot. Instead it only learns the news here.
 *
 * From then on, the next in-app navigation to another page is a full page load
 * of that page. That load is also what activates the waiting worker
 * (`reloadOntoNewBuild`). The player asked to leave the page anyway, so nothing
 * on it is lost, and wizard drafts survive a load (`lib/wizard/wizardDraft.ts`).
 * Search-param changes on the same page and back/forward stay in-app.
 *
 * Intent preloading also stops. Once another tab's activation has cleared the
 * old precache, a hover would fetch an old chunk name the server no longer
 * has. That would fail, and chunk recovery would reload the page under the
 * pointer.
 *
 * A breaking deploy takes the other path: the build floor stops this tab
 * writing and reloads it (`src/lib/connection/buildFloor.ts`).
 */

/** "A new build is live", raised once per page. */
export type BuildSignal = {
  markLive: () => void
  /** Runs `listener` once the build is live, or now if it already is. Returns an unsubscribe. */
  onLive: (listener: () => void) => () => void
}

export function createBuildSignal(): BuildSignal {
  let live = false
  const listeners = new Set<() => void>()
  return {
    markLive() {
      if (live) return
      live = true
      for (const listener of listeners) listener()
      listeners.clear()
    },
    onLive(listener) {
      if (live) {
        listener()
        return () => undefined
      }
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** This page's signal: `registerServiceWorker` raises it, `installSoftUpdate` acts on it. */
export const newBuild: BuildSignal = createBuildSignal()

/** The slice of the router this uses. */
export type SoftUpdateRouter = { history: Pick<RouterHistory, 'block'> } & Pick<
  AnyRouter,
  'preloadRoute'
>

/**
 * Once `signal` is live, turns the next page change into a full load of that
 * page on the new build. `go` performs the load. Tests pass a recorder. Returns
 * a teardown.
 */
export function installSoftUpdate(
  router: SoftUpdateRouter,
  signal: BuildSignal = newBuild,
  go: (href: string) => void = (href) =>
    void reloadOntoNewBuild(undefined, () => window.location.assign(href))
): () => void {
  let unblock: (() => void) | undefined
  let moving = false

  const blockerFn: BlockerFn = ({ currentLocation, nextLocation, action }) => {
    // Back/forward and same-page updates (search params, hash) stay in-app.
    if (action !== 'PUSH' && action !== 'REPLACE') return false
    if (nextLocation.pathname === currentLocation.pathname) return false
    // A second click while the first load is under way changes nothing.
    if (!moving) {
      moving = true
      go(nextLocation.href)
    }
    return true
  }

  const stopListening = signal.onLive(() => {
    router.preloadRoute = async () => undefined
    unblock = router.history.block({
      // A full load is already the user's own navigation: no "leave site?" prompt.
      enableBeforeUnload: false,
      blockerFn,
    })
  })

  return () => {
    stopListening()
    unblock?.()
  }
}
