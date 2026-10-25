import { ConvexAuthProvider } from '@convex-dev/auth/react'
import type { ReactNode } from 'react'
import { convexClient } from '../../lib/connection/convexClient'
import { SyncProvider } from '../../replica/SyncProvider'

/** Mounts the Convex client and its auth provider, with the sync status under them. */
export function AppConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convexClient}>
      <SyncProvider>{children}</SyncProvider>
    </ConvexAuthProvider>
  )
}
