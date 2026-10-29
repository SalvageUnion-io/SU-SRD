import type { Page, TestInfo } from '@playwright/test'
import { test as base, expect } from '@playwright/test'
import type { SeamAccount } from 'gates/lib/testSignIn'
import {
  seamIsPresent as seamPresent,
  signInThroughSeam,
  TEST_SIGN_IN_GLOBAL,
} from 'gates/lib/testSignIn'
import { at } from './_base'
import { waitForReady } from './_helpers'

/**
 * The app e2e `test`, signed in by default.
 *
 * ## Why every spec signs in
 *
 * A build lands in exactly one place: the account. Signed out, the app is
 * read-only and refuses every write, so every spec that builds something is a
 * test of the signed-in path, run the way production runs.
 *
 * ## How it signs in
 *
 * Through `TestAuthBridge`, the build-time test seam that calls the
 * Worker's test-only sign-in (`POST /auth/test-sign-in`), by `signInThroughSeam`
 * (`packages/gates/lib/testSignIn.ts`, the one caller of the seam). Each test signs up a fresh account, because a
 * reused one would inherit the last run's roster and assert against it. Two
 * things must line up (see `signin-save.e2e.ts`'s header): `VITE_TEST_AUTH=true`
 * in the build, and `TEST_AUTH=true` on the Worker. `build-web`
 * in `.github/workflows/ci.yml` (every PR) and `e2e` in
 * `.github/workflows/e2e-nightly.yml` provide both against a local
 * Worker (`.github/actions/test-build`).
 *
 * ## When the seam is absent
 *
 * A build without it (a production build, or one made without `test-auth`)
 * cannot sign in, so a signed-in spec SKIPS with the reason stated rather than failing — a spec that
 * went red in every ordinary run would be deleted the first time it annoyed
 * somebody. Once a run has deliberately provisioned the seam
 * (`E2E_EXPECT_AUTH_SEAM`), absence means the seam broke, and it THROWS
 * instead.
 *
 * A local `bun run e2e` always has the seam: Playwright boots (or reuses)
 * `bun run dev`, which sets `VITE_TEST_AUTH` and runs the Worker with
 * `TEST_AUTH`, so it needs no setup.
 *
 * ## Opting out
 *
 * A spec about what an anonymous visitor sees says so with
 * `test.use({ account: 'anonymous' })`.
 */

/**
 * The app's per-test budget. The first navigation of a test pulls in
 * salvageunion-reference (a large JSON dataset) and, against the dev server,
 * Vite's lazy compile of the Training Bay and builder routes: 30-60 s on GHA
 * Ubuntu runners. 90 s leaves headroom without masking a real hang; against a
 * deployed origin (`E2E_BASE_URL`) every test also pays real round trips.
 */
const TEST_TIMEOUT = process.env.E2E_BASE_URL ? 150_000 : 90_000

type AccountFixture = {
  /** `signed-in` (default) signs up a fresh account before the test body runs. */
  account: 'signed-in' | 'anonymous'
}

/** A fresh account per test — a reused one would inherit the last run's roster. */
function uniqueCredentials(): SeamAccount {
  // `crypto.randomUUID()`, not `Math.random()`: this stamp is part of a password.
  const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  return { email: `e2e-${stamp}@example.invalid`, password: `pw-${stamp}-Aa1!` }
}

/**
 * How long a build that carries the seam may take to register it. `TestAuthBridge`
 * registers in an effect once the auth provider mounts, which can land after
 * the game-data flag `waitForReady` awaits.
 */
const SEAM_REGISTER_MS = 15_000

/**
 * Whether the seam (`__appTestSignIn`, `gates/lib/testSignIn.ts`) is, or within
 * `SEAM_REGISTER_MS` becomes, present. Waited for, never probed once: a single
 * `evaluate` raced the bridge's effect, and a spec that lost the race threw on
 * its first attempt and passed on the retry.
 */
export async function seamIsPresent(page: Page): Promise<boolean> {
  return await seamPresent(page, SEAM_REGISTER_MS)
}

/**
 * Skip, or fail, when there is no seam — see the header for which, and why the
 * difference matters.
 */
export function requireSeam(present: boolean, testInfo: TestInfo): void {
  if (!present && process.env.E2E_EXPECT_AUTH_SEAM) {
    throw new Error(
      `E2E_EXPECT_AUTH_SEAM is set, but no \`${TEST_SIGN_IN_GLOBAL}\` seam is present. ` +
        'The build was expected to expose it (VITE_TEST_AUTH + TEST_AUTH); ' +
        'either the seam regressed or the build lost a variable.'
    )
  }
  testInfo.skip(
    !present,
    'Needs an account, and this build has no test sign-in seam (VITE_TEST_AUTH ' +
      'and TEST_AUTH). See apps/web/e2e/fixtures.ts.'
  )
}

/** Sign a fresh account up through the seam and wait until the app is Connected. */
export async function signInFresh(page: Page): Promise<void> {
  await signInThroughSeam(page, uniqueCredentials())
}

export const test = base.extend<AccountFixture>({
  account: ['signed-in', { option: true }],
  page: async ({ page, account }, use, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT)
    if (account === 'signed-in') {
      await page.goto(at('/'))
      await waitForReady(page)
      requireSeam(await seamIsPresent(page), testInfo)
      await signInFresh(page)
    }
    await use(page)
  },
})

export { expect }
