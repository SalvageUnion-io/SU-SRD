import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Smoke test — proves the Playwright harness works against the dev server
 * and the app boots without crashing.
 *
 * A fresh Playwright browser context has empty IndexedDB, so the dashboard is
 * always in its "first run" state here (Dashboard.tsx `isFirstRun`, added by
 * PR #366) — it renders FirstRunWelcome, not the three-column Pilots/Mechs/
 * Crawlers grid, so there is no "Create Pilot"/"Create Mech"/"Create Crawler"
 * link to find on a truly empty store. This asserts the actual first-run UI
 * a real new visitor (and CI) always sees. The populated-dashboard grid and
 * full pilot/mech/crawler build flows are covered by the other e2e specs
 * (e.g. dashboard-delete.e2e.ts, pilot-build.e2e.ts) in the nightly suite.
 */
test('dashboard loads and shows the first-run welcome', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  // App title is present
  await expect(page).toHaveTitle(/In The Union Now/i)

  // First-run welcome renders with its single primary CTA.
  await expect(page.getByRole('heading', { name: /Welcome to In the Union Now/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Build your first pilot/i })).toBeVisible()
})
