import { ConvexProviderWithAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useWorkerAuth } from '../../lib/auth/session'
import { convexClient } from '../../lib/connection/convexClient'
import { SyncProvider } from '../../replica/SyncProvider'

/** Mounts the Convex client on the Worker's session, with the sync status under it. */
export function AppConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convexClient} useAuth={useWorkerAuth}>
      <SyncProvider>{children}</SyncProvider>
    </ConvexProviderWithAuth>
  )
}
