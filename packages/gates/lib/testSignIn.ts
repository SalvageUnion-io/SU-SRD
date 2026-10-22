/**
 * The test sign-in seam, called the one way: the e2e fixtures
 * (`apps/web/e2e/fixtures.ts`), the gallery and `bun run dev:backend`'s seed
 * (`seedAccount.ts`) and `bun run shot --signed-in` all sign in here.
 *
 * The seam is `TestAuthBridge` (`apps/web/src/build/account/`), a function the
 * app sets on `window` in a build made with `VITE_TEST_AUTH=true`. Its name
 * and signature are kept in step with `testAuthSeam.model.ts` and the bridge
 * by `TestAuthBridge.test.tsx`, which reads this file: Playwright code and the
 * tools cannot import app source that reads `import.meta.env`.
 */
import type { Page } from '@playwright/test'

/** The global the bridge sets (`testAuthSeam.model.ts`'s `TEST_SIGN_IN_GLOBAL`). */
export const TEST_SIGN_IN_GLOBAL = '__appTestSignIn'

/**
 * The seam's signature (`TestAuthBridge.tsx`): `signUp` makes the account,
 * `signIn` returns to one (the seeded account `bun run shot --signed-in` reuses).
 */
export type TestSignIn = (
  email: string,
  password: string,
  flow?: 'signUp' | 'signIn'
) => Promise<void>

/** A test account: its email and password. */
export type SeamAccount = { email: string; password: string }

/**
 * Whether the seam is (or within `timeout` becomes) present. Waited for, never
 * probed once: the bridge registers in an effect once the auth provider
 * mounts, which can land after the page's game data is ready.
 */
export async function seamIsPresent(page: Page, timeout: number): Promise<boolean> {
  return await page
    .waitForFunction(
      (name) => typeof (globalThis as unknown as Record<string, unknown>)[name] === 'function',
      TEST_SIGN_IN_GLOBAL,
      { timeout }
    )
    .then(
      () => true,
      () => false
    )
}

/**
 * Sign `account` in through the seam on the open app page (`signUp` unless
 * `flow` says otherwise) and wait until the app is Connected. Throws when the
 * page has no seam within 30 s.
 */
export async function signInThroughSeam(
  page: Page,
  account: SeamAccount,
  { flow = 'signUp' }: { flow?: 'signUp' | 'signIn' } = {}
): Promise<void> {
  if (!(await seamIsPresent(page, 30_000)))
    throw new Error(
      `no \`${TEST_SIGN_IN_GLOBAL}\` seam on ${page.url()}: the build needs VITE_TEST_AUTH and the deployment TEST_AUTH`
    )
  await page.evaluate(
    async ({ name, email, password, flow }) => {
      const signIn = (globalThis as unknown as Record<string, TestSignIn>)[name]
      await signIn?.(email, password, flow)
    },
    { name: TEST_SIGN_IN_GLOBAL, email: account.email, password: account.password, flow }
  )
  // The masthead's "Games" menu renders only in `connected` (GamesMenu), the
  // mode whose backend is the account: waiting on the token alone would let a
  // first write race the backend flip. It sits in Play's nav, which the bar
  // keeps in the DOM but hides outside Play, so it is waited for attached.
  await page
    .getByRole('button', { name: 'Games', includeHidden: true })
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
}
