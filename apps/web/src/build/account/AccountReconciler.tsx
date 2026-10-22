/**
 * AccountReconciler — keeps the stores the signed-in account's.
 *
 * The stores hold one account's Convex rows in memory, and the device copy
 * keeps the last of them for an offline reload (ADR-056;
 * `docs/ARCHITECTURE.md#device-copy`). Nothing held is ever sent up: every
 * row came from the server or from a write it accepted first, so the server is
 * always the copy to keep.
 *
 * ## Signed out: render nothing
 *
 * What a signed-out player sees is the Roster's sign-in panel. A tab whose
 * session ends drops the rows it loaded and the device copy
 * (`forgetLoadedRows`), whichever tab signed out.
 *
 * ## Connected: sync
 *
 * `ShelfSync` mounts while the server of record is in play and brings the
 * account's rows down. A dropped connection unmounts it and keeps what is on
 * screen, read-only (Disconnected).
 *
 * ## Booted offline: restore
 *
 * A load that starts Disconnected, with a session on the device and nothing
 * served yet, reads the device copy into the stores once
 * (`restoreDeviceCopy`), read-only like any Disconnected session.
 */

import { useEffect, useRef } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
import { dropCopy, settleRestore } from '../../stores/deviceCopy'
import { restoreDeviceCopy } from '../../stores/deviceCopyRestore'
import { backendForMode } from '../../stores/entityBackend'
import { forgetLoadedRows } from '../../stores/sessionRows'
import { ShelfSync } from './ShelfSync'

/**
 * Mounted once, at the root. A fact about the browser and the session, not
 * about a route.
 */
export function AccountReconciler() {
  const { mode, outdated } = useConnection()
  const backend = backendForMode(mode)

  // The rows this tab loaded go when its session ends, whichever tab signed
  // out: there is no tab-to-tab channel, so each tab acts on its own sight of
  // the session ending. Only when the backend changes to signed out: a mount
  // that starts there has loaded nothing of a session's to drop. `blocked`
  // (a dropped connection) is the same sign-in and keeps its rows.
  const lastBackend = useRef(backend)
  useEffect(() => {
    const was = lastBackend.current
    lastBackend.current = backend
    if (backend === 'signedOut' && was !== 'signedOut') forgetLoadedRows()
    // Signed out from the start: a copy left by a session that ended while
    // this device was away is nobody's to show.
    else if (backend === 'signedOut') void dropCopy()
  }, [backend])

  // Booted offline: the device copy, once. Any other mode settles a pending
  // restore, so a store's `hydrate()` never waits on one that will not run.
  useEffect(() => {
    if (mode === 'disconnected') void restoreDeviceCopy()
    else if (mode !== 'connecting') settleRestore()
  }, [mode])

  // Signed out there is nothing to show. `blocked` is Disconnected or
  // mid-handshake, and an outdated tab reloads onto the new build: nothing to
  // sync.
  if (backend !== 'remote' || outdated === true) return null
  return <ShelfSync />
}
