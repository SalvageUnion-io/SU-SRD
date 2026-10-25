import { ConvexProviderWithAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useWorkerAuth } from '../../lib/auth/session'
import { ConnectionProvider } from '../../lib/connection/ConnectionProvider'
import { convexClient } from '../../lib/connection/convexClient'

/** Mounts the Convex client on the Worker's session, with the connection mode under it. */
export function AppConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convexClient} useAuth={useWorkerAuth}>
      <ConnectionProvider>{children}</ConnectionProvider>
    </ConvexProviderWithAuth>
  )
}
