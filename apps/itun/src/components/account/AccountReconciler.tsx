/**
 * AccountReconciler — keeps the local cache the signed-in account's.
 *
 * IndexedDB is a cache of one account's Convex rows (ADR-034). Nothing on the
 * device is ever sent up: every row there came from the server or from a write
 * it accepted first, so the server is always the copy to keep.
 *
 * ## Signed out: render nothing
 *
 * What a signed-out player sees is the Roster's sign-in panel. A tab whose
 * session ends drops the rows it loaded (`forgetLoadedRows`); the tab that
 * signed out empties the database itself (`useSignOutAndForget`).
 *
 * ## Signed in: make the cache this account's, then sync it
 *
 * Before anything syncs, the cache is checked against the signed-in account
 * (`claimCacheFor`): rows another account left behind, or rows that belong to
 * nobody, are dropped. Only then does `ShelfSync` mount and refill the cache
 * from the server.
 */

import { useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { claimCacheFor, forgetLoadedRows } from '../../lib/account/cacheOwner'
import { useConnection } from '../../lib/connection/connectionContext'
import { captureException } from '../../lib/observability'
import { backendForMode } from '../../stores/entityBackend'
import { ShelfSync } from './ShelfSync'

/** The signed-in half. Mounted only while the backend is `remote`. */
function SignedInReconciler() {
  const me = useQuery(api.account.me, {})

  /**
   * The account the cache has been confirmed to belong to. Nothing syncs into
   * the cache until it is this one — otherwise the last account's rows would be
   * adopted or pruned as this one's.
   */
  const userId = me?._id ?? null
  const [cacheOwner, setCacheOwner] = useState<string | null>(null)
  const cacheReady = userId !== null && cacheOwner === userId

  useEffect(() => {
    if (userId === null) return
    let cancelled = false
    void claimCacheFor(userId)
      .then(() => {
        if (!cancelled) setCacheOwner(userId)
      })
      .catch((err: unknown) => {
        // Nothing syncs while the owner is unconfirmed, so a failure here
        // leaves the cache as it was rather than mixing two accounts in it.
        captureException(err)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  return cacheReady ? <ShelfSync /> : null
}

/**
 * Mounted once, at the root. A fact about the browser and the session, not
 * about a route.
 */
export function AccountReconciler() {
  const { mode } = useConnection()
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
  // mid-handshake: nothing to sync.
  if (backend !== 'remote') return null
  return <SignedInReconciler />
}
