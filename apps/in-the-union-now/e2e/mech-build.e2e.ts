import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Mech-only build — chassis selection (via the EntityChoiceCard grid) +
 * mech name → submit. Verifies the new card-based ChassisSelector works in
 * a real browser and that submit lands on the dashboard with the mech
 * visible.
 */
test('build a mech from scratch', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  // Mule is one of the SU starter chassis and exists in the canonical data
  // set — if the data ever loses Mule, switch to another guaranteed chassis.
  await pickByName(page, 'Mule')

  await page.getByLabel(/Mech name/i).fill('Iron Fist')

  await page.getByRole('button', { name: /Create Mech/i }).click()

  await page.waitForURL(/\/(mechs\/|$)/, { timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible({ timeout: 15_000 })
})
