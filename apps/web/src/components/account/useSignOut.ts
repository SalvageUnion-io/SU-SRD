import { useAuthActions } from '@convex-dev/auth/react'
import { useCallback } from 'react'
import { clearAccountHint } from '../../lib/accountHint'
import { captureException } from '../../lib/builderObservability'
import { localStore } from '../../lib/safeLocalStorage'

/**
 * Sign out — the one sign-out, for every control that offers it
 * (`AccountMenu`, `SignInControl`, the `/sign-out` route the SRD's menu opens).
 *
 * The one account value on the device is the account hint the SRD's bar reads
 * (`src/lib/accountHint`); it goes first, so no bar shows the player
 * signed in once they asked to leave. When the session ends,
 * `AccountReconciler` drops the rows this tab loaded (`stores/sessionRows.ts`).
 * Resolves once the session is over, or the attempt failed and was reported.
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuthActions()
  return useCallback(async () => {
    clearAccountHint(localStore())
    try {
      await signOut()
    } catch (err: unknown) {
      // The control stays as it was, signed in; worth knowing about, not
      // worth a dialog.
      captureException(err)
    }
  }, [signOut])
}
