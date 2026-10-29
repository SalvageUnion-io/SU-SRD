import { buildPilot, openApp, waitForReady } from './_helpers'
import { openTrainingBay } from './_trainingBay'
import { expect, requireSeam, seamIsPresent, signInFresh, test } from './fixtures'

// Anonymous on purpose: it starts signed out, and signs in mid-test.
test.use({ account: 'anonymous' })

/**
 * Sign in → build → save (ADR-034 decision 1, as amended).
 *
 * Signed out, the app is read-only: a visitor who opens a wizard is asked to sign
 * in instead, so there is never unsaved anonymous work to hand off. This pins
 * both halves — the refusal, and that what is built after signing in is
 * durable — and it is a consumer of the Worker's test sign-in
 * (`POST /auth/test-sign-in`). Without the specs that sign in, that route is an
 * auth surface with no consumer, so fix this file rather than delete it.
 *
 * ## What it needs
 *
 * Two things have to line up (`fixtures.ts`, "How it signs in"):
 *
 *  - `TEST_AUTH=true` on the Worker, so `/auth/test-sign-in` answers,
 *  - `VITE_TEST_AUTH=true` in the build, so `TestAuthBridge` registers the seam.
 *
 * Both CI tiers carry them against a local Worker (`.github/actions/test-build`
 * with `test-auth`), with state destroyed with the runner, and both set
 * `E2E_EXPECT_AUTH_SEAM`, so a lost seam throws there rather than skipping.
 * This spec is not tagged `@pr`: it runs nightly (`e2e` in
 * `.github/workflows/e2e-nightly.yml`), with every untagged spec. A build
 * without the seam (production) skips it with the reason stated.
 *
 * Run it for real against the local Worker (no setup). Playwright starts
 * `bun run dev`, or reuses a running one, which carries both:
 *
 *   cd apps/web && bunx playwright test --project=desktop signin-save.e2e.ts
 */

test('a signed-out visitor is asked to sign in, and what they build then is saved', async ({
  page,
}, testInfo) => {
  await openApp(page, '/')

  // Skips in an ordinary build, THROWS in a run that provisioned the seam —
  // see `fixtures.ts`. Historical note, because it is the reason the throw
  // exists: for a long time no workflow set any of the three variables, so this
  // spec skipped everywhere including nightly while reading as coverage.
  requireSeam(await seamIsPresent(page), testInfo)

  // Signed out, the wizard is a sign-in panel: nothing can be built.
  await openApp(page, '/pilots/new')
  await expect(page.getByRole('heading', { name: 'Sign in to build a pilot' })).toBeVisible()
  await expect(page.getByRole('button', { name: /guided/i })).toHaveCount(0)

  await signInFresh(page)
  await buildPilot(page, 'Saved By Signing In', 'Keeper')
  await expect(page.getByText('Saved By Signing In').first()).toBeVisible({ timeout: 30_000 })

  // Reload to prove it is DURABLE — on the server, not merely in this tab:
  // nothing is kept on the device, so what shows after a reload came from the rooms.
  await page.reload()
  await waitForReady(page)
  await openTrainingBay(page)
  await expect(page.getByText('Saved By Signing In').first()).toBeVisible()
})
