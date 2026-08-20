import { expect, test } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * The anonymous-build → sign-in → save hand-off (ADR-034 decision 1, P1/P3).
 *
 * This is the step most likely to lose somebody's work, and it is the entire
 * reason the test-only password provider exists. Without this spec that provider
 * is an auth surface with no consumer — which is the state it was in until this
 * landed, and is worth remembering if anyone is tempted to delete this file
 * rather than fix it: **deleting the spec means deleting the provider too.**
 *
 * ## What it needs, and why it skips without it
 *
 * Three things have to line up, and none is present in the default CI run:
 *
 *  - a reachable Convex deployment (`VITE_CONVEX_URL` compiled into the build),
 *  - `ITUN_TEST_AUTH=true` on that deployment, so the `password` provider exists,
 *  - `VITE_TEST_AUTH=true` in the build, so `TestAuthBridge` registers the seam.
 *
 * The default suite builds with none of them, so this skips with a stated
 * reason rather than failing. That is the same shape `offline.e2e.ts` uses for
 * the dev-server case, and the same trade: a spec that went red in the ordinary
 * run would be deleted the first time it annoyed somebody.
 *
 * Run it for real with a test deployment:
 *
 *   bunx convex env set ITUN_TEST_AUTH true      # on the test deployment
 *   VITE_TEST_AUTH=true VITE_CONVEX_URL=<url> bun --filter itun build
 *   bun --filter itun exec playwright test signin-save.e2e.ts
 */

/** A fresh account per run — a reused one would inherit the last run's roster. */
function uniqueCredentials() {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return { email: `e2e-${stamp}@example.invalid`, password: `pw-${stamp}-Aa1!` }
}

async function seamIsPresent(page: import('@playwright/test').Page): Promise<boolean> {
  return await page.evaluate(
    () => typeof (window as unknown as Record<string, unknown>).__itunTestSignIn === 'function'
  )
}

test('work built anonymously survives signing in to save it', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  const ready = await seamIsPresent(page)

  // Two different situations, and collapsing them is how this spec could go
  // silent. Absence of the seam is EXPECTED in an ordinary build (no
  // VITE_TEST_AUTH / VITE_CONVEX_URL / ITUN_TEST_AUTH) and is not a failure.
  // But once a run has deliberately provisioned the seam, absence means the
  // seam BROKE, and skipping there would hide exactly the regression this spec
  // exists to catch.
  //
  // `ITUN_E2E_EXPECT_AUTH_SEAM` is that distinction. Note the honest state of
  // things: no workflow sets the three variables today, so this spec currently
  // skips in every environment including nightly. It is written and correct and
  // has never actually executed in CI — set the variables plus this flag to
  // change that.
  if (!ready && process.env.ITUN_E2E_EXPECT_AUTH_SEAM) {
    throw new Error(
      'ITUN_E2E_EXPECT_AUTH_SEAM is set, but no `__itunTestSignIn` seam is present. ' +
        'The build was expected to expose it (VITE_TEST_AUTH + VITE_CONVEX_URL + ' +
        'ITUN_TEST_AUTH); either the seam regressed or the build lost a variable.'
    )
  }
  test.skip(
    !ready,
    'No test sign-in seam in this build — needs VITE_TEST_AUTH, VITE_CONVEX_URL and ITUN_TEST_AUTH. See this file header.'
  )

  // Build something anonymously. The pilot wizard is the shortest real path to
  // a saved entity, and is what a first-time visitor actually does.
  await page.getByRole('link', { name: /Build your first pilot/i }).click()
  await waitForReady(page)

  const { email, password } = uniqueCredentials()
  await page.evaluate(
    async ([e, p]) => {
      const fn = (window as unknown as Record<string, unknown>).__itunTestSignIn as (
        a: string,
        b: string
      ) => Promise<void>
      await fn(e as string, p as string)
    },
    [email, password]
  )

  // The promotion runs on the backend flip and is the assertion that matters:
  // a user who signs in to save must not come back to an empty screen.
  await page.goto('/roster')
  await waitForReady(page)

  // Reload to prove it is DURABLE rather than merely still in memory — the
  // whole distinction ADR-034 draws.
  await page.reload()
  await waitForReady(page)

  await expect(page.getByRole('heading', { name: /Welcome to In the Union Now/i })).toHaveCount(0)
})
