import { waitForReady } from './_helpers'
import { expect, test } from './fixtures'

// Anonymous on purpose: this spec is about what a first-time visitor sees.
test.use({ account: 'anonymous' })

/**
 * Smoke test — proves the Playwright harness works against the dev server
 * and the app boots without crashing.
 *
 * A first-time visitor is signed out, and signed out ITUN is read-only
 * (ADR-034 as amended): `/` is the front door (board 09) asking them to sign
 * in, with no create affordance. The populated roster and the build flows are
 * covered, signed in, by the other e2e specs in the nightly suite.
 */
test('the roster loads and asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  // App title is present
  await expect(page).toHaveTitle(/In The Union Now/i)

  // The front door's chapter band, and nothing to build with until they sign in.
  await expect(page.getByRole('heading', { level: 1, name: /^In The Union Now$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to build' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Build your first pilot|Create Pilot/i })
  ).toHaveCount(0)
})
