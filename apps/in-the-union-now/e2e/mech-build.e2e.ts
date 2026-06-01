import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Mech-only build — steps through the chassis-first wizard (Chassis ->
 * Loadout -> Identity -> Review) and submits. Verifies the card-based
 * ChassisSelector + stepper flow work in a real browser and that submit
 * lands on the dashboard with the mech visible.
 *
 * The Next button is matched with `exact: true` because chassis/system cards
 * are themselves role=button and some contain the substring "next" in their
 * body text.
 */
test('build a mech from scratch', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  // Step 1 — Chassis. Mule is a guaranteed SU starter chassis.
  await pickByName(page, 'Mule')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2 — Loadout (systems/modules/cargo optional)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3 — Identity
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 4 — Review -> create
  await page.getByRole('button', { name: /Create Mech/i }).click()

  await page.waitForURL(/\/(mechs\/|$)/, { timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible({ timeout: 15_000 })
})
