import type { ReactNode } from 'react'
import { ConvexAuthProvider } from '@convex-dev/auth/react'

import { ConnectionProvider } from '../../lib/connection/ConnectionProvider'
import { convexClient } from '../../lib/connection/convexClient'

/**
 * Mounts the Convex client and auth provider **only when this build has a
 * deployment configured**, and supplies the connection mode either way.
 *
 * A checkout that has never run `bunx convex dev` has no `VITE_CONVEX_URL`
 * (it lives in gitignored `.env.local`), so `convexClient` is null and this
 * renders the children with a Solo `ConnectionProvider` and no Convex context
 * at all. That is the pre-accounts app, unchanged and fully working — which is
 * what makes anonymous play first-class rather than a degraded fallback
 * (ADR-030 §1).
 *
 * Consequence worth knowing: in such a build **no component may call a Convex
 * hook unconditionally**, because there is no provider above it. Route Convex
 * reads through a component that only renders when `isConvexConfigured`.
 */
export function AppConvexProvider({ children }: { children: ReactNode }) {
  if (convexClient === null) {
    return <ConnectionProvider>{children}</ConnectionProvider>
  }

  return (
    <ConvexAuthProvider client={convexClient}>
      <ConnectionProvider>{children}</ConnectionProvider>
    </ConvexAuthProvider>
  )
}
