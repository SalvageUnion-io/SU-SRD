import { useAuthActions } from '@convex-dev/auth/react'
import { Button, cn } from '../../components/index'
import { buildAccountCopy } from '../../messages/build-account'
import { useSync } from '../../replica/syncContext'
import { useSignOut } from './useSignOut'

/**
 * The Union bar's treatment: an outline in the bar's own foreground
 * (`--su-bar-fg`, whatever band the bar wears), `.su-union-bar__action`
 * (`partials/shell.css`), the bar's one outlined control, which "Buy the game"
 * and the Reference's Sign in wear too.
 *
 * Both states use it, including sign-in. `variant="primary"` is right on the
 * paper settings screen and in the mobile drawer, but in the masthead it would
 * put a second rust button directly beside "Buy the game" — two identical
 * CTAs, neither reading as the primary one. The bar keeps one loud action.
 */
const BAR_BUTTON = 'su-union-bar__action'

type SignInControlProps = {
  /** Sits in the Union bar: outlined in the bar's foreground, never a second rust CTA. */
  inBar?: boolean
  /**
   * Where Discord's round trip lands, as a route in the app: Convex Auth
   * appends a relative `redirectTo` to its `SITE_URL`, the app's base. An
   * invite link passes its own route, so signing in from it comes back to it
   * and joins; a Play route lands under the base, and the Worker 301s it to
   * `/play` (`retiredTarget`). Unset, the deployment's site URL.
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
  const { status } = useSync()

  if (status === 'live') {
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
  if (status === 'offline') return null

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
