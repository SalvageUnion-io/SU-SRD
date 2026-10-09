import { ConvexAuthProvider } from '@convex-dev/auth/react'
import type { ReactNode } from 'react'
import { ConnectionProvider } from '../../lib/connection/ConnectionProvider'
import { convexClient } from '../../lib/connection/convexClient'

/** Mounts the Convex client and its auth provider, with the connection mode under them. */
export function AppConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convexClient}>
      <ConnectionProvider>{children}</ConnectionProvider>
    </ConvexAuthProvider>
  )
}
