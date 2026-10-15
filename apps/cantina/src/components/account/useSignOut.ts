import { useAuthActions } from '@convex-dev/auth/react'
import { useCallback } from 'react'
import { captureException } from '../../lib/observability'

/**
 * Sign out — the one sign-out, for every control that offers it
 * (`AccountMenu`, `SignInControl`).
 *
 * Nothing of the account is kept on the device, so there is nothing to clear
 * here: when the session ends, `AccountReconciler` drops the rows this tab
 * loaded (`stores/sessionRows.ts`).
 */
export function useSignOut(): () => void {
  const { signOut } = useAuthActions()
  return useCallback(() => {
    void signOut().catch((err: unknown) => {
      // The control stays as it was, signed in; worth knowing about, not
      // worth a dialog.
      captureException(err)
    })
  }, [signOut])
}
