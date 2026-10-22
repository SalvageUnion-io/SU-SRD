import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { sessionAccount } from '../../stores/deviceCopy'
import { setEntityBackendAuthState } from '../../stores/entityBackend'
import { useBuildFloor } from './buildFloor'
import type { ConnectionState } from './connectionContext'
import { ConnectionContext } from './connectionContext'
import {
  isSettlingConnection,
  resolveConnectionMode,
  shouldWarnDisconnected,
  writesAllowed,
} from './connectionMode'

/** Tracks `navigator.onLine`, kept current by the browser's own events. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    function up() {
      setOnline(true)
    }
    function down() {
      setOnline(false)
    }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return online
}

function useConnectionState(
  signedIn: boolean,
  authSettled: boolean,
  outdated: boolean
): ConnectionState {
  const online = useOnline()
  // Read again whenever the network or the handshake moves; it is one scan of
  // localStorage's keys.
  const storedSession = useMemo(
    () => !authSettled && !online && sessionAccount() !== null,
    [authSettled, online]
  )

  // The stores are not components and cannot call hooks, so the mode is PUSHED
  // to them from here rather than pulled. One writer, one direction — and it
  // happens in an effect so a render never has a side effect.
  useEffect(() => {
    setEntityBackendAuthState({ signedIn, online, authSettled, outdated, storedSession })
  }, [signedIn, online, authSettled, outdated, storedSession])

  return useMemo(() => {
    const mode = resolveConnectionMode({ authSettled, signedIn, online, storedSession })
    return {
      mode,
      canWrite: writesAllowed(mode) && !outdated,
      showDisconnectedWarning: shouldWarnDisconnected(mode),
      settling: isSettlingConnection(mode),
      outdated,
    }
  }, [signedIn, online, authSettled, outdated, storedSession])
}

/** Supplies the current storage mode (ADR-030 §1) to the tree. */
export function ConnectionProvider({ children }: { children: ReactNode }) {
  // All three flags matter: `isAuthenticated` is false for the whole initial
  // handshake, so on its own it would read that window as signed out.
  const { isAuthenticated, isLoading, isRefreshing } = useConvexAuth()
  // The one build-floor subscriber: signed in or not, a tab older than the
  // backend stops writing and reloads onto the new build (buildFloor.ts).
  const outdated = useBuildFloor()
  const state = useConnectionState(isAuthenticated, !isLoading && !isRefreshing, outdated)
  return <ConnectionContext.Provider value={state}>{children}</ConnectionContext.Provider>
}
