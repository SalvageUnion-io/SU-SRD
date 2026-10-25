/**
 * ReplicaSync: keeps the replica the signed-in account's. Mounted
 * once, in the root route; renders nothing but the feed.
 *
 *  - Signed in: the replica is kept on the device for this account
 *    (`persist.ts`) and, live, the feed fills it (`ConvexFeed`). Booted
 *    offline, what the device kept is what there is, read as arrived.
 *  - Signed out after a session: every held row and the device's copy go,
 *    whichever tab signed out, so the next account starts empty. Signed out
 *    from the start, a copy left by a session that ended while the device was
 *    away is nobody's to show, and goes too.
 */

import { useEffect, useRef } from 'react'
import { ConvexFeed } from './ConvexFeed'
import { forgetOutbox } from './outbox'
import { dropFromDevice, keepOnDevice, sessionAccount } from './persist'
import { clear, markArrived, rowsComingChanged, setRowsComing, TABLES } from './replica'
import type { SyncStatus } from './sync'
import { isSignedIn, subscribeSync, syncStatus } from './sync'
import { useSync } from './syncContext'

/** Whether the device's copy is still being read. */
let reading = false
/** Whether the feed is mounted: until it answers, every table's rows are coming. */
let feeding = false

// Rows are on their way while the session settles (`main.tsx` boots
// `syncing`), the device is read, or the feed has yet to answer; a table's
// `hydrate()` waits only then. In a unit test, signed out, none are coming.
setRowsComing(() => reading || feeding || syncStatus() === 'syncing')
subscribeSync(rowsComingChanged)

/** Keep the replica the account's as the status moves. */
export function ReplicaSync() {
  const { status, outdated } = useSync()
  // Null on mount, so a boot that starts signed in still starts keeping.
  const last = useRef<SyncStatus | null>(null)
  useEffect(() => {
    feeding = status === 'live' && !outdated
    rowsComingChanged()
    return () => {
      feeding = false
      rowsComingChanged()
    }
  }, [status, outdated])
  useEffect(() => {
    const was = last.current
    last.current = status
    if (status === 'signedOut') {
      // A session that ended here, or one that ended while the device was
      // away: its rows are nobody's to show.
      void dropFromDevice()
      forgetOutbox()
      if (was !== null && was !== 'signedOut') clear()
      return
    }
    if (!isSignedIn(status) || (was !== null && isSignedIn(was))) return
    const account = sessionAccount()
    if (account === null) return
    reading = true
    rowsComingChanged()
    void keepOnDevice(account).finally(() => {
      reading = false
      // Offline, the device's copy is the answer.
      if (syncStatus() === 'offline') markArrived(TABLES)
      rowsComingChanged()
    })
  }, [status])
  return status === 'live' && !outdated ? <ConvexFeed /> : null
}
