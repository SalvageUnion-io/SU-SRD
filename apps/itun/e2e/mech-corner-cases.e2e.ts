import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * MechWizard corner cases (chassis-first WizShell wizard):
 *  - The stepper gates progress: Next is disabled until a chassis is chosen,
 *    then the Pattern step requires a pattern (a custom build needs a name),
 *    then Identity requires a mech name before Create is enabled on Review.
 *  - The combined Loadout step renders the 1fr/300px grid: TL filter chips on
 *    the left, the 'Loadout · {name}' panel with budget tracks on the right,
 *    split by Systems / Modules tabs.
 *
 * The primary CTA is labeled from the steps array ('Next · Pattern →'), so
 * the shared clickNext/^Next ·/ matcher is used throughout.
 */

test('wizard gates progress until chassis + pattern + name are set', async ({ page }) => {
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Chassis step — Next disabled until a chassis is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Mule')
  await expect(next).toBeEnabled()
  await clickNext(page) // -> Pattern

  // Pattern step — Custom build requires a name before advancing.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Custom Pattern')
  await expect(next).toBeDisabled()
  await page.getByLabel(/Pattern name/i).fill('Field Rig')
  await expect(next).toBeEnabled()
  await clickNext(page) // -> Loadout
  await clickNext(page) // -> Identity (loadout optional)

  // Identity step — Next disabled until a name is entered.
  await expect(next).toBeDisabled()
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await expect(next).toBeEnabled()

  // Identity -> Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Mech/i })).toBeEnabled()
})

test('loadout step shows TL filter chips and the Loadout budget panel', async ({ page }) => {
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)

  // Chassis -> Pattern (custom) -> Loadout.
  await pickByName(page, 'Mule')
  await clickNext(page) // -> Pattern
  await pickByName(page, 'Custom Pattern')
  await page.getByLabel(/Pattern name/i).fill('Field Rig')
  await clickNext(page) // -> Loadout

  // Left column — TL filter chips.
  await expect(page.getByRole('button', { name: 'TL1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'TL6' })).toBeVisible()

  // Right column — Loadout panel with the pip budget tracks (Systems tab).
  await expect(page.getByText(/Loadout ·/)).toBeVisible()
  await expect(page.getByText(/System Slots ·/i)).toBeVisible()
  await expect(page.getByText(/Energy ·/i).first()).toBeVisible()

  // The Modules tab shows its own budget track.
  await page.getByRole('tab', { name: 'Modules' }).click()
  await expect(page.getByText(/Module Slots ·/i)).toBeVisible()
})
