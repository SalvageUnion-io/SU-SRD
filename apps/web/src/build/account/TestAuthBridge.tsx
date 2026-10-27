/**
 * TestAuthBridge — the browser half of the test sign-in.
 *
 * ## Why this exists
 *
 * Discord OAuth has no credential a Playwright fixture can present, so the
 * Worker has a test sign-in (`POST /auth/test-sign-in`, `src/worker/auth/`)
 * for end-to-end tests. Nothing in the UI reaches it: `SignInControl` renders
 * one Discord button, so this is the door a browser test uses.
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
 * drops the branch. Only the `dev` script (the dev server, never `vite build`)
 * and the nightly e2e build set it; no committed env file does, and
 * `__tests__/TestAuthBridge.test.tsx` asserts the default is off.
 *
 * It is also useless without its server half: the Worker answers the seam's
 * route only with `TEST_AUTH=true` (a test build's `.dev.vars`). Both flags
 * have to be wrong at once for this to be reachable.
 */

import { useEffect } from 'react'
import { testSignIn } from '../../lib/auth/session'
import { TEST_SIGN_IN_GLOBAL, testAuthBridgeEnabled } from './testAuthSeam.model'

type TestSignIn = (email: string, password: string, flow?: 'signUp' | 'signIn') => Promise<void>

function Bridge() {
  useEffect(() => {
    // `signUp` by default: each e2e run wants a fresh account with an empty
    // shelf. A run that reused an account would inherit the previous run's
    // roster and assert against it. `signIn` returns to an existing account:
    // the seeded one `tools/dev-backend.ts` made, which `bun run shot
    // --signed-in` reuses.
    const fn: TestSignIn = (email, password, flow = 'signUp') => testSignIn(email, password, flow)
    ;(window as unknown as Record<string, TestSignIn>)[TEST_SIGN_IN_GLOBAL] = fn

    return () => {
      delete (window as unknown as Record<string, unknown>)[TEST_SIGN_IN_GLOBAL]
    }
  }, [])

  return null
}

export function TestAuthBridge() {
  // A production build folds the whole subtree away on this constant.
  if (!testAuthBridgeEnabled) return null
  return <Bridge />
}
