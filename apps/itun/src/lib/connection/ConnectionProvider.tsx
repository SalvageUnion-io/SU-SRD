import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { setEntityBackendAuthState } from '../../stores/entityBackend'
import type { ConnectionState } from './connectionContext'
import { ConnectionContext } from './connectionContext'
import {
  isSettlingConnection,
  resolveConnectionMode,
  shouldWarnDisconnected,
  writesAllowed,
} from './connectionMode'
import { convexClient, isConvexConfigured } from './convexClient'

/**
 * Supplies the current storage mode (ADR-030 §1) to the tree.
 *
 * ## Why this is two components instead of one `if`
 *
 * `useConvexAuth` throws without a `ConvexProvider` above it, and a build with
 * no `VITE_CONVEX_URL` deliberately has no provider — that build is Solo
 * forever, which is a supported state, not a broken one (CI runs in it, and so
 * does any contributor who has not run `convex dev`).
 *
 * A conditional hook call would violate the rules of hooks, so the branch is
 * made at the *component* level instead: `ConvexBackedConnection` calls the
 * Convex hook, `SoloConnection` never does. The branch is decided by a
 * build-time constant, so a given build always renders the same one and React
 * sees a stable component identity across every render.
 */

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

function useConnectionState(signedIn: boolean, authSettled: boolean): ConnectionState {
  const online = useOnline()

  // The stores are not components and cannot call hooks, so the mode is PUSHED
  // to them from here rather than pulled. One writer, one direction — and it
  // happens in an effect so a render never has a side effect.
  useEffect(() => {
    setEntityBackendAuthState({ signedIn, online, authSettled })
  }, [signedIn, online, authSettled])

  return useMemo(() => {
    const mode = resolveConnectionMode({
      convexConfigured: isConvexConfigured,
      authSettled,
      signedIn,
      online,
    })
    return {
      mode,
      canWrite: writesAllowed(mode),
      showDisconnectedWarning: shouldWarnDisconnected(mode),
      settling: isSettlingConnection(mode),
    }
  }, [signedIn, online, authSettled])
}

function ConvexBackedConnection({ children }: { children: ReactNode }) {
  // All three flags matter, and discarding the latter two is what used to make
  // the initial handshake masquerade as Solo: `isAuthenticated` is false for the
  // whole of it, and Solo silently routes writes to IndexedDB with no mirror.
  const { isAuthenticated, isLoading, isRefreshing } = useConvexAuth()
  const state = useConnectionState(isAuthenticated, !isLoading && !isRefreshing)
  return <ConnectionContext.Provider value={state}>{children}</ConnectionContext.Provider>
}

function SoloConnection({ children }: { children: ReactNode }) {
  // No account is possible in this build, so `signedIn` is structurally false —
  // and there is no auth layer to wait for, so the session is settled by
  // construction rather than by having resolved.
  const state = useConnectionState(false, true)
  return <ConnectionContext.Provider value={state}>{children}</ConnectionContext.Provider>
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  if (!isConvexConfigured || convexClient === null) {
    return <SoloConnection>{children}</SoloConnection>
  }
  return <ConvexBackedConnection>{children}</ConvexBackedConnection>
}
