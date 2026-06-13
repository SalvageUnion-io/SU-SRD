import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * MechWizard corner cases (chassis-first WizShell wizard):
 *  - The stepper gates progress: Next is disabled until a chassis is chosen,
 *    then disabled again on Identity until a name is entered, and Create is
 *    enabled on Review.
 *  - The install steps render the 1fr/300px grid: TL filter chips on the
 *    left, the 'Loadout · {name}' panel with budget tracks on the right.
 *
 * The primary CTA is labeled from the steps array ('Next · Systems →'), so
 * the shared clickNext/^Next ·/ matcher is used throughout.
 */

test('wizard gates progress until chassis + name are set', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Chassis step — Next disabled until a chassis is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Mule')
  await expect(next).toBeEnabled()

  // Chassis -> Systems -> Modules -> Identity
  await clickNext(page)
  await clickNext(page)
  await clickNext(page)

  // Identity step — Next disabled until a name is entered.
  await expect(page.getByRole('button', { name: /^Next ·/ })).toBeDisabled()
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await expect(page.getByRole('button', { name: /^Next ·/ })).toBeEnabled()

  // Identity -> Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Mech/i })).toBeEnabled()
})

test('install steps show TL filter chips and the Loadout budget panel', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  // Chassis step -> pick -> advance to Install Systems.
  await pickByName(page, 'Mule')
  await clickNext(page)

  // Left column — TL filter chips.
  await expect(page.getByRole('button', { name: 'TL1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'TL6' })).toBeVisible()

  // Right column — Loadout panel with the pip budget tracks.
  await expect(page.getByText(/Loadout ·/)).toBeVisible()
  await expect(page.getByText(/System Slots ·/i)).toBeVisible()
  await expect(page.getByText(/Energy ·/i).first()).toBeVisible()

  // Modules step shows its own budget track.
  await clickNext(page)
  await expect(page.getByText(/Module Slots ·/i)).toBeVisible()
})
