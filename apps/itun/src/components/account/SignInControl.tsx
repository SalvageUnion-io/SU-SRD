import { useAuthActions } from '@convex-dev/auth/react'
import { Button } from 'component-lib'
import { useConnection } from '../../lib/connection/connectionContext'
import { useSignOutAndForget } from './useSignOutAndForget'

/**
 * The dark-masthead treatment: a paper hairline on the near-black bar. The
 * merge order in `Button`'s `cn()` lets these win over the variant's own
 * border/text colours.
 *
 * Both states use it, including sign-in. `variant="primary"` is right on the
 * paper settings screen and in the mobile drawer, but in the masthead it would
 * put a second rust button directly beside "Buy the game" — two identical
 * CTAs, neither reading as the primary one. The bar keeps one loud action.
 */
const DARK_BUTTON = 'border-paper/40 bg-transparent text-paper hover:border-paper hover:bg-paper/10'

type SignInControlProps = {
  /** Render for a dark surface (the masthead nav) instead of paper. */
  onDark?: boolean
  /**
   * Where Discord's round trip lands, as a path on this site (Convex Auth
   * accepts a relative `redirectTo`). An invite link passes its own address,
   * so signing in from it comes back to it and joins (issue 1255). Unset, the
   * deployment's site URL.
   */
  redirectTo?: string
  /** The button's words. Defaults to "Sign in with Discord". */
  label?: string
  /** `full` for a page's primary call to action (the front door). */
  size?: 'compact' | 'full'
}

/** Sign in / sign out with Discord. */
export function SignInControl({
  onDark,
  redirectTo,
  label = 'Sign in with Discord',
  size = 'compact',
}: SignInControlProps) {
  const { signIn } = useAuthActions()
  const signOut = useSignOutAndForget()
  const { mode } = useConnection()

  if (mode === 'connected') {
    return (
      <Button
        variant="ghost"
        size="compact"
        className={onDark ? DARK_BUTTON : undefined}
        onClick={signOut}
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
      size={size}
      className={onDark ? DARK_BUTTON : undefined}
      onClick={() =>
        void (redirectTo === undefined ? signIn('discord') : signIn('discord', { redirectTo }))
      }
    >
      {label}
    </Button>
  )
}
