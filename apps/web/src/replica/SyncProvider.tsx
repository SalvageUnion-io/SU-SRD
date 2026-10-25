/**
 * SyncProvider: works out the sync status (`sync.ts`) once, near the root,
 * and publishes it to the tree (`useSync`) and to the replica's writers.
 * `ReplicaSync` (mounted once, in the root route) keeps the replica the
 * signed-in account's.
 */

import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from '../components/containers/Toaster'
import { useBuildFloor } from '../lib/connection/buildFloor'
import { sharedCopy } from '../messages/components-shared'
import { flushOutbox } from './outbox'
import { sessionAccount } from './persist'
import { setSyncStatus, syncStatusOf } from './sync'
import type { SyncState } from './syncContext'
import { SyncContext } from './syncContext'

/** `navigator.onLine`, kept current by the browser's own events. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

export function SyncProvider({ children }: { children: ReactNode }) {
  // All three flags matter: `isAuthenticated` is false for the whole initial
  // handshake, so on its own it would read that window as signed out.
  const { isAuthenticated, isLoading, isRefreshing } = useConvexAuth()
  // The one build-floor subscriber: a tab older than the backend stops writing
  // and reloads onto the new build.
  const outdated = useBuildFloor()
  const online = useOnline()
  const authSettled = !isLoading && !isRefreshing
  const storedSession = useMemo(
    () => !authSettled && !online && sessionAccount() !== null,
    [authSettled, online]
  )
  const status = syncStatusOf({ authSettled, signedIn: isAuthenticated, online, storedSession })

  // The replica's writers are not components: the status is pushed to them.
  useEffect(() => setSyncStatus(status, outdated), [status, outdated])

  const state = useMemo<SyncState>(
    () => ({
      status,
      canWrite: status === 'live' && !outdated,
      canEditOwn: (status === 'live' || status === 'offline') && !outdated,
      outdated,
    }),
    [status, outdated]
  )

  // Back live: what waited in the outbox goes up, and a refused edit says so.
  useEffect(() => {
    if (status !== 'live' || outdated) return
    void flushOutbox().then((declined) => {
      for (const reason of declined) toast.error(sharedCopy('offlineChangeDeclined', { reason }))
    })
  }, [status, outdated])
  return <SyncContext.Provider value={state}>{children}</SyncContext.Provider>
}
