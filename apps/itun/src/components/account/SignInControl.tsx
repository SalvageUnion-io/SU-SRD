import { Button } from 'component-lib'
import { useAuthActions } from '@convex-dev/auth/react'

import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'

/**
 * Sign in / sign out with Discord.
 *
 * ## The Solo-build branch, again
 *
 * `useAuthActions` needs a `ConvexAuthProvider` above it, and a build with no
 * `VITE_CONVEX_URL` deliberately has none. So this file uses the same
 * component-level branch as `ConnectionProvider`: the hook lives in
 * `ConvexSignIn`, which is only ever rendered when the build is configured.
 * The branch is a build-time constant, so React sees a stable component
 * identity across renders.
 *
 * In a Solo build this renders **nothing at all** rather than a disabled
 * button. Offering an account to somebody whose app cannot have one is worse
 * than silence — signing in is an upgrade, not a missing feature (ADR-030 §1).
 */

function ConvexSignIn() {
  const { signIn, signOut } = useAuthActions()
  const { mode } = useConnection()

  if (mode === 'connected') {
    return (
      <Button variant="ghost" size="compact" onClick={() => void signOut()}>
        Sign out
      </Button>
    )
  }

  // Disconnected means signed in but unreachable — offering "sign in" there
  // would be nonsense, and the NOT CONNECTED banner already explains the state.
  if (mode === 'disconnected') return null

  return (
    <Button variant="primary" size="compact" onClick={() => void signIn('discord')}>
      Sign in with Discord
    </Button>
  )
}

export function SignInControl() {
  if (!isConvexConfigured) return null
  return <ConvexSignIn />
}
