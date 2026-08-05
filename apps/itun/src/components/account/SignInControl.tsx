import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from 'component-lib'
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

/**
 * The dark-masthead treatment: a paper hairline on the near-black bar. The
 * merge order in `Button`'s `cn()` lets these win over the variant's own
 * border/text colours.
 *
 * Both states use it, including sign-in. `variant="primary"` is right on the
 * paper account screen, but in the masthead it would put a second rust button
 * directly under "Buy the game" — two identical CTAs, neither reading as the
 * primary one. The utility row stays quiet; the bar keeps one loud action.
 */
const DARK_BUTTON = 'border-paper/40 bg-transparent text-paper hover:border-paper hover:bg-paper/10'

type SignInControlProps = {
  /** Render for a dark surface (the masthead utility row) instead of paper. */
  onDark?: boolean
}

function ConvexSignIn({ onDark }: SignInControlProps) {
  const { signIn, signOut } = useAuthActions()
  const { mode } = useConnection()

  if (mode === 'connected') {
    return (
      <Button
        variant="ghost"
        size="compact"
        className={onDark ? DARK_BUTTON : undefined}
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    )
  }

  // Disconnected means signed in but unreachable — offering "sign in" there
  // would be nonsense, and the NOT CONNECTED banner already explains the state.
  if (mode === 'disconnected') return null

  return (
    <Button
      variant={onDark ? 'ghost' : 'primary'}
      size="compact"
      className={onDark ? DARK_BUTTON : undefined}
      onClick={() => void signIn('discord')}
    >
      Sign in with Discord
    </Button>
  )
}

export function SignInControl({ onDark }: SignInControlProps) {
  if (!isConvexConfigured) return null
  return <ConvexSignIn onDark={onDark} />
}
