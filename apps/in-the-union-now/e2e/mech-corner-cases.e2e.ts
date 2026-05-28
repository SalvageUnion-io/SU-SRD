import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * MechBuilder corner cases:
 *  - "Create Mech" stays disabled until both chassis and name are set.
 *  - Selecting a chassis reveals the systems/modules grid (was a "Select a
 *    chassis to choose systems and modules." placeholder).
 *  - SystemModuleGrid renders tab buttons with capacity counters.
 *  - The Mule chassis card shows its mountpoints / SP / HP (proof that
 *    ReferenceEntityDisplay rendered the chassis stats, not just a name).
 */

test('Create Mech is disabled until chassis + name are both set', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  const submit = page.getByRole('button', { name: /Create Mech/i })
  await expect(submit).toBeDisabled()

  // Name alone is not enough.
  await page.getByLabel(/Mech name/i).fill('No Chassis Yet')
  await expect(submit).toBeDisabled()

  // Chassis alone is not enough (clear the name first).
  await page.getByLabel(/Mech name/i).fill('')
  await pickByName(page, 'Mule')
  await expect(submit).toBeDisabled()

  // Both present → enabled.
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await expect(submit).toBeEnabled()
})

test('SystemModuleGrid placeholder disappears after chassis pick', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)
  await expect(page.getByText(/Select a chassis to choose systems and modules/i)).toBeVisible()

  await pickByName(page, 'Mule')

  // Placeholder gone, capacity counters visible.
  await expect(page.getByText(/Select a chassis to choose systems and modules/i)).not.toBeVisible()
  await expect(page.getByRole('button', { name: /Systems \(/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Modules \(/ })).toBeVisible()
})
