/**
 * When a store's rows have arrived.
 *
 * There is no device cache (the D9 decision, `docs/ARCHITECTURE.md#no-device-cache`):
 * a store holds what `ShelfSync` brings down from Convex this page load, so
 * "hydrated" means **the server's answer is in**, not "the disk was read". A
 * store's `hydrate()` waits on this module, and resolves:
 *
 *  - when `ShelfSync` marks the store arrived (its first emission applied), or
 *  - as soon as no rows are on their way: signed out, Disconnected, outdated,
 *    or signed in with no sync mounted (a unit test, a story).
 *
 * While the auth handshake is still in flight (`connecting`) rows may be on
 * their way, so it waits: a route opened at boot shows its skeleton rather than
 * an empty roster that fills a moment later.
 */

import { backendSettling, selectBackend, subscribeBackend } from './entityBackend'

const syncListeners = new Set<() => void>()
let mountedSyncs = 0

/** Whether rows may still be on their way to the stores. */
function rowsOnTheWay(): boolean {
  if (backendSettling()) return true
  return mountedSyncs > 0 && selectBackend() === 'remote'
}

/**
 * `ShelfSync` registers while it is mounted. Returns the unregister, for the
 * effect's cleanup.
 */
export function registerSync(): () => void {
  mountedSyncs += 1
  notifySyncs()
  let registered = true
  return () => {
    if (!registered) return
    registered = false
    mountedSyncs -= 1
    notifySyncs()
  }
}

function notifySyncs(): void {
  for (const listener of [...syncListeners]) listener()
}

/**
 * Resolve once `arrived()` holds or no rows are coming, re-checked on every
 * change to the store (`subscribe`), to the backend and to the mounted syncs.
 */
export function untilRowsArrive(
  arrived: () => boolean,
  subscribe: (listener: () => void) => () => void
): Promise<void> {
  return new Promise((resolve) => {
    const stops: Array<() => void> = []
    let done = false
    const check = (): void => {
      if (done || (!arrived() && rowsOnTheWay())) return
      done = true
      for (const stop of stops) stop()
      resolve()
    }
    syncListeners.add(check)
    stops.push(subscribe(check), subscribeBackend(check), () => syncListeners.delete(check))
    check()
  })
}
