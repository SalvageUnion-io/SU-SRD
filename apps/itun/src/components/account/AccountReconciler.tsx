/**
 * AccountReconciler — keeps the stores the signed-in account's.
 *
 * The stores hold one account's Convex rows in memory, and nothing on the
 * device (ADR-034; `docs/ARCHITECTURE.md#no-device-cache`). Nothing held
 * is ever sent up: every row came from the server or from a write it accepted
 * first, so the server is always the copy to keep.
 *
 * ## Signed out: render nothing
 *
 * What a signed-out player sees is the Roster's sign-in panel. A tab whose
 * session ends drops the rows it loaded (`forgetLoadedRows`), whichever tab
 * signed out.
 *
 * ## Connected: sync
 *
 * `ShelfSync` mounts while the server of record is in play and brings the
 * account's rows down. A dropped connection unmounts it and keeps what is on
 * screen, read-only (Disconnected); a reload while offline starts empty.
 */

import { useEffect, useRef } from 'react'
import { useConnection } from '../../lib/connection/connectionContext'
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
  }, [backend])

  // Signed out there is nothing to show. `blocked` is Disconnected or
  // mid-handshake, and an outdated tab reloads onto the new build: nothing to
  // sync.
  if (backend !== 'remote' || outdated === true) return null
  return <ShelfSync />
}
