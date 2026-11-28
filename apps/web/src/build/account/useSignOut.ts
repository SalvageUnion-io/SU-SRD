import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'
import { clearAccountHint } from '../../lib/accountHint'
import { signOut } from '../../lib/auth/session'
import { captureException } from '../../lib/observability'
import { localStore } from '../../lib/safeLocalStorage'

/**
 * Sign out — the one sign-out, for every control that offers it
 * (`AccountMenu`, `SignInControl`, the `/sign-out` route the SRD's menu opens).
 *
 * The one account value on the device is the account hint the SRD's bar reads
 * (`src/lib/accountHint`); it goes first, so no bar shows the player
 * signed in once they asked to leave. When the session ends,
 * `ReplicaSync` drops the rows this tab held (`replica.clear`).
 * Resolves once the session is over, or the attempt failed and was reported.
 *
 * Signed out, the player goes home: the page they left (Settings, a Game) has
 * nothing to show them. `SignOutHandoff` then returns the SRD's menu to the
 * page it came from.
 */
export function useSignOut(): () => Promise<void> {
  // Probed, as `LaunchPlay` does: a component test may have no router.
  const router = useRouter({ warn: false })
  return useCallback(async () => {
    clearAccountHint(localStore())
    try {
      await signOut()
    } catch (err: unknown) {
      // The control stays as it was, signed in; worth knowing about, not
      // worth a dialog.
      captureException(err)
      return
    }
    void router?.navigate({ to: '/' })
  }, [router])
}
