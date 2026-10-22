import { useAuthActions } from '@convex-dev/auth/react'
import { Button, cn } from '../../components/index'
import { useConnection } from '../../lib/connection/connectionContext'
import { buildAccountCopy } from '../../messages/build-account'
import { useSignOut } from './useSignOut'

/**
 * The Union bar's treatment: an outline in the bar's own foreground
 * (`--su-bar-fg`, whatever band the bar wears). `.su-sign-in-control--bar`
 * (`styles/screens.css`) is an app rule outside the cascade layers, so it wins
 * over the variant's own border/text colours and its hover ink wash.
 *
 * Both states use it, including sign-in. `variant="primary"` is right on the
 * paper settings screen and in the mobile drawer, but in the masthead it would
 * put a second rust button directly beside "Buy the game" — two identical
 * CTAs, neither reading as the primary one. The bar keeps one loud action.
 */
const BAR_BUTTON = 'su-sign-in-control--bar'

type SignInControlProps = {
  /** Sits in the Union bar: outlined in the bar's foreground, never a second rust CTA. */
  inBar?: boolean
  /**
   * Where Discord's round trip lands, as a path on this site (Convex Auth
   * accepts a relative `redirectTo`). An invite link passes its own address,
   * so signing in from it comes back to it and joins. Unset, the
   * deployment's site URL.
   */
  redirectTo?: string
  /** The button's words. Defaults to "Sign in with Discord". */
  label?: string
  /** `full` for a page's primary call to action (the front door). */
  size?: 'compact' | 'full'
  /** Placement classes from the caller, e.g. `su-page-action` on a sheet band. */
  className?: string
}

/** Sign in / sign out with Discord. */
export function SignInControl({
  inBar,
  redirectTo,
  label = 'Sign in with Discord',
  size = 'compact',
  className,
}: SignInControlProps) {
  const { signIn } = useAuthActions()
  const signOut = useSignOut()
  const { mode } = useConnection()

  if (mode === 'connected') {
    return (
      <Button
        variant="ghost"
        size="compact"
        className={cn(inBar && BAR_BUTTON, className)}
        onClick={signOut}
      >
        {buildAccountCopy('signOut')}
      </Button>
    )
  }

  // Disconnected means signed in but unreachable — offering "sign in" there
  // would be nonsense, and the NOT CONNECTED banner already explains the state.
  if (mode === 'disconnected') return null

  return (
    <Button
      variant={inBar ? 'ghost' : 'primary'}
      size={size}
      className={cn(inBar && BAR_BUTTON, className)}
      onClick={() =>
        void (redirectTo === undefined ? signIn('discord') : signIn('discord', { redirectTo }))
      }
    >
      {label}
    </Button>
  )
}
