import type { Page, TestInfo } from '@playwright/test'
import { test as base, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * The ITUN e2e `test`, signed in by default.
 *
 * ## Why every spec signs in now
 *
 * There are two places a build can land: the in-memory backend for an
 * anonymous visitor, and the account. Only the second survives a reload, so
 * every spec that builds something and reads it back after a `goto` or a
 * `reload` is, by definition, a test of the signed-in path.
 *
 * It used to be a test of a third path instead. The suite built a production
 * bundle with `VITE_REQUIRE_ACCOUNT=false` forced on, which kept the retired
 * `local` backend alive — durable IndexedDB for an anonymous visitor — so the
 * suite spent its whole run proving a storage mode no player could reach.
 * `local` and the flag are gone; the suite now runs the way production does.
 *
 * ## How it signs in
 *
 * Through `TestAuthBridge`, the build-time test seam that calls the
 * test-only `password` provider. Each test signs up a fresh account, because a
 * reused one would inherit the last run's roster and assert against it. Three
 * things must line up (see `signin-save.e2e.ts`'s header): `VITE_CONVEX_URL`
 * and `VITE_TEST_AUTH=true` in the build, and `ITUN_TEST_AUTH=true` on the
 * deployment. `e2e-itun` in `.github/workflows/e2e-nightly.yml` provides all
 * three against a throwaway self-hosted Convex backend.
 *
 * ## When the seam is absent
 *
 * A build without it (the PR-blocking smoke tier, a contributor's
 * `bun run e2e:itun` with no Convex) cannot sign in, so a signed-in spec SKIPS
 * with the reason stated rather than failing — a spec that went red in every
 * ordinary run would be deleted the first time it annoyed somebody. Once a run
 * has deliberately provisioned the seam (`ITUN_E2E_EXPECT_AUTH_SEAM`), absence
 * means the seam broke, and it THROWS instead.
 *
 * ## Opting out
 *
 * A spec about what an anonymous visitor sees says so with
 * `test.use({ account: 'anonymous' })`.
 */

type AccountFixture = {
  /** `signed-in` (default) signs up a fresh account before the test body runs. */
  account: 'signed-in' | 'anonymous'
}

/** Kept in step with `testAuthSeam.ts` by `TestAuthBridge.test.tsx`. */
const TEST_SIGN_IN_GLOBAL = '__itunTestSignIn'

/** A fresh account per test — a reused one would inherit the last run's roster. */
export function uniqueCredentials(): { email: string; password: string } {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { email: `e2e-${stamp}@example.invalid`, password: `pw-${stamp}-Aa1!` }
}

export async function seamIsPresent(page: Page): Promise<boolean> {
  return await page.evaluate(
    (name) => typeof (window as unknown as Record<string, unknown>)[name] === 'function',
    TEST_SIGN_IN_GLOBAL
  )
}

/**
 * Skip, or fail, when there is no seam — see the header for which, and why the
 * difference matters.
 */
export function requireSeam(present: boolean, testInfo: TestInfo): void {
  if (!present && process.env.ITUN_E2E_EXPECT_AUTH_SEAM) {
    throw new Error(
      'ITUN_E2E_EXPECT_AUTH_SEAM is set, but no `__itunTestSignIn` seam is present. ' +
        'The build was expected to expose it (VITE_TEST_AUTH + VITE_CONVEX_URL + ' +
        'ITUN_TEST_AUTH); either the seam regressed or the build lost a variable.'
    )
  }
  testInfo.skip(
    !present,
    'Needs an account, and this build has no test sign-in seam (VITE_TEST_AUTH, ' +
      'VITE_CONVEX_URL and ITUN_TEST_AUTH). See apps/itun/e2e/fixtures.ts.'
  )
}

/** Call the seam with a fresh account and wait until the app is Connected. */
export async function signInFresh(page: Page): Promise<void> {
  const { email, password } = uniqueCredentials()
  await page.evaluate(
    async ([name, e, p]) => {
      const fn = (window as unknown as Record<string, unknown>)[name as string] as (
        a: string,
        b: string
      ) => Promise<void>
      await fn(e as string, p as string)
    },
    [TEST_SIGN_IN_GLOBAL, email, password]
  )
  // "Sign out" renders only in `connected` (SignInControl), which is the mode
  // whose backend is the account. Waiting on the token alone would let the
  // test's first write race the backend flip.
  await expect(page.getByRole('button', { name: 'Sign out' }).first()).toBeVisible({
    timeout: 30_000,
  })
}

export const test = base.extend<AccountFixture>({
  account: ['signed-in', { option: true }],
  page: async ({ page, account }, use, testInfo) => {
    if (account === 'signed-in') {
      await page.goto('/')
      await waitForReady(page)
      requireSeam(await seamIsPresent(page), testInfo)
      await signInFresh(page)
    }
    await use(page)
  },
})

export { expect }
