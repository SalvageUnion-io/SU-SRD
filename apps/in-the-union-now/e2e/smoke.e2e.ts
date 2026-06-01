import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Smoke test — proves the Playwright harness works against the dev server
 * and the app boots without crashing.
 */
test('dashboard loads and shows the Create Pilot link', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)

  // App title is present
  await expect(page).toHaveTitle(/In The Union Now/i)

  // The dashboard exposes builder links for all three entity types
  await expect(page.getByRole('link', { name: /Create Pilot/i }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Create Mech/i }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Create Crawler/i }).first()).toBeVisible()
})
