import { useAuthActions } from '@convex-dev/auth/react'
import { useCallback } from 'react'
import { forgetCache } from '../../lib/account/cacheOwner'
import { captureException } from '../../lib/observability'

/**
 * Sign out, and take the account's cached rows with the session.
 *
 * The one sign-out, for every control that offers it (`AccountMenu`,
 * `SignInControl`). The account's rows go with the session, so nothing is left
 * in IndexedDB for the next account to sign in on this browser.
 *
 * Session first, cache second: once signed out nothing syncs into the cache
 * again, so what is cleared stays cleared. A rare write that lands in between
 * is caught at the next sign-in, which drops rows recorded as nobody's.
 */
export function useSignOutAndForget(): () => void {
  const { signOut } = useAuthActions()
  return useCallback(() => {
    void signOut()
      .then(forgetCache)
      .catch((err: unknown) => {
        // The session may be gone and the cache not; the next sign-in's owner
        // check drops it either way, so this is worth knowing about rather than
        // worth stopping for.
        captureException(err)
      })
  }, [signOut])
}
