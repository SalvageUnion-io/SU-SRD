/**
 * TestAuthBridge — the missing half of P1, and the reason the test-only
 * password provider is not dead code.
 *
 * ## Why this exists
 *
 * `convex/auth.ts` gained a `Password` provider so that an end-to-end test
 * could sign in — Discord OAuth has no credential a Playwright fixture can
 * present. But a provider on the server is only half a door: **nothing in the
 * UI can reach it.** `SignInControl` renders one Discord button, so a browser
 * test had nothing to click and the provider sat unused, which is an auth
 * surface with no consumer.
 *
 * ## Why a global function rather than a hidden button
 *
 * A rendered control would need a label, a place in the layout, an accessible
 * name, and a decision about what happens if a real user ever sees it. A
 * function on `window` has none of that and cannot be clicked by accident. It
 * is also honest about what it is: a test seam, not a feature.
 *
 * ## Why it cannot reach production
 *
 * Gated on `VITE_TEST_AUTH === 'true'`, a **build-time** flag, so a production
 * bundle does not contain the registration at all — Vite folds the constant and
 * drops the branch. `apps/itun/.env.production` does not set it, and
 * `__tests__/TestAuthBridge.test.tsx` asserts the default is off.
 *
 * It is also useless without its server half: `ITUN_TEST_AUTH` must be set on
 * the deployment for the `password` provider to exist at all. Both flags have to
 * be wrong at once for this to be reachable, and each is asserted separately.
 */

import { useAuthActions } from '@convex-dev/auth/react'
import { useEffect } from 'react'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { TEST_SIGN_IN_GLOBAL, testAuthBridgeEnabled } from './testAuthSeam'

type TestSignIn = (email: string, password: string) => Promise<void>

function Bridge() {
  const { signIn } = useAuthActions()

  useEffect(() => {
    const fn: TestSignIn = async (email, password) => {
      // `signUp` rather than `signIn`: each e2e run wants a fresh account with
      // an empty shelf, and Convex Auth's Password provider creates one on
      // demand. A run that reused an account would inherit the previous run's
      // roster and assert against it.
      await signIn('password', { email, password, flow: 'signUp' })
    }
    ;(window as unknown as Record<string, TestSignIn>)[TEST_SIGN_IN_GLOBAL] = fn

    return () => {
      delete (window as unknown as Record<string, unknown>)[TEST_SIGN_IN_GLOBAL]
    }
  }, [signIn])

  return null
}

export function TestAuthBridge() {
  // Both guards, in this order. The flag first so a production build folds the
  // whole subtree away; `isConvexConfigured` second because `useAuthActions`
  // needs a provider above it and a build with no Convex URL mounts none.
  if (!testAuthBridgeEnabled) return null
  if (!isConvexConfigured) return null
  return <Bridge />
}
