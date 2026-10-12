/**
 * The two constants describing the test sign-in seam.
 *
 * Split out of `TestAuthBridge.tsx` because that file exports a component, and
 * a module that exports both a component and plain values breaks Fast Refresh
 * (`lint/style/useComponentExportOnlyModules`). They are also the two things
 * *tests* need to import, which is a second reason not to reach through a
 * component module for them.
 */

/**
 * Whether this build carries the test sign-in seam.
 *
 * Exported so its default can be asserted rather than described. Exact string
 * match, for the same reason `ITUN_TEST_AUTH` is: a truthy check would turn
 * `VITE_TEST_AUTH=false` into an enabled seam.
 */
export const testAuthBridgeEnabled = import.meta.env.VITE_TEST_AUTH === 'true'

/**
 * The name a Playwright fixture calls.
 *
 * Exported, and pinned by a test, because a typo surfaces inside
 * `page.evaluate` as "seam not present" — which SKIPS the hand-off spec rather
 * than failing it. A rename would quietly turn that spec into a no-op.
 */
export const TEST_SIGN_IN_GLOBAL = '__itunTestSignIn'
