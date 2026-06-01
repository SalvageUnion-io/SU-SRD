import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * MechBuilder corner cases (chassis-first stepper wizard):
 *  - The stepper gates progress: Next is disabled until a chassis is chosen,
 *    then disabled again on Identity until a name is entered, and Create is
 *    enabled on Review.
 *  - The Loadout step renders the systems/modules grid with capacity counters.
 *
 * The Next button is matched with `exact: true` because chassis/system cards
 * are themselves role=button and some contain "next" in their body text.
 */

test('wizard gates progress until chassis + name are set', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: 'Next', exact: true })

  // Chassis step — Next disabled until a chassis is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Mule')
  await expect(next).toBeEnabled()

  // Chassis -> Loadout -> Identity
  await next.click()
  await next.click()

  // Identity step — Next disabled until a name is entered.
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()

  // Identity -> Review — Create is enabled.
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: /Create Mech/i })).toBeEnabled()
})

test('Loadout step shows the systems/modules grid after chassis pick', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  // Chassis step -> pick -> advance to Loadout.
  await pickByName(page, 'Mule')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Loadout step — capacity-counter tab buttons visible.
  // Anchored regexes (^) match only the SystemModuleGrid tab buttons
  // (e.g. "Systems (0/16)"), not chassis cards that contain "Systems".
  await expect(page.getByRole('button', { name: /^Systems \(/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Modules \(/ })).toBeVisible()
})
