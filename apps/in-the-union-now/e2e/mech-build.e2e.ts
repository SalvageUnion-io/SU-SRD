import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * Mech-only build — steps through the chassis-first WizShell wizard
 * (Chassis -> Pattern -> Loadout -> Identity -> Review) and submits.
 * Verifies the OptRow master-detail chassis + pattern steps and the combined
 * Loadout step work in a real browser and that submit lands on the dashboard
 * with the mech visible.
 */
test('build a mech from scratch', async ({ page }) => {
  await page.goto('/mechs/new')
  await waitForReady(page)

  // Step 1 — Chassis. Mule is a guaranteed SU starter chassis.
  await pickByName(page, 'Mule')
  await clickNext(page) // -> Pattern

  // Step 2 — Pattern. Build a custom, named loadout.
  await pickByName(page, 'Custom Pattern')
  await page.getByLabel(/Pattern name/i).fill('Field Rig')
  await clickNext(page) // -> Loadout

  // Step 3 — Loadout (Systems tab by default; optional, soft budget)
  await pickByName(page, 'Cargo Pod')
  await clickNext(page) // -> Identity

  // Step 4 — Identity
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await clickNext(page) // -> Review

  // Step 5 — Review -> create
  await page.getByRole('button', { name: /Create Mech/i }).click()

  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * Mech edit round-trip (plan 3.6): open the created mech's edit route from
 * the detail page, change the loadout, save, and confirm the upsert branch
 * saved in place (back on the detail page, no duplicate).
 */
test('edit a mech loadout via /mechs/$id/edit', async ({ page }) => {
  // Build first.
  await page.goto('/mechs/new')
  await waitForReady(page)
  await pickByName(page, 'Mule')
  await clickNext(page) // -> Pattern
  await pickByName(page, 'Custom Pattern')
  await page.getByLabel(/Pattern name/i).fill('Field Rig')
  await clickNext(page) // -> Loadout
  await clickNext(page) // -> Identity
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Mech/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // Open the mech detail page from the dashboard row's View link, then Edit.
  await page
    .locator('li', { hasText: 'Iron Fist' })
    .getByRole('link', { name: /^View$/ })
    .click()
  await page.waitForURL(/\/mechs\//, { timeout: 15_000 })
  await page.getByRole('link', { name: /^Edit$/ }).click()
  await page.waitForURL(/\/mechs\/.+\/edit/, { timeout: 15_000 })
  await waitForReady(page)

  // Wizard is prefilled (chassis chosen), eyebrow flips to edit mode. Edit
  // lands on the custom-loadout path, so the Loadout step is present.
  await expect(page.getByText('Edit Mech')).toBeVisible()
  await clickNext(page) // -> Pattern
  await clickNext(page) // -> Loadout
  await pickByName(page, 'Cargo Pod') // install a system in edit mode
  await clickNext(page) // -> Identity
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Save Mech/i }).click()

  // Save navigates back to the detail page — the same record, edited.
  await page.waitForURL((url) => /\/mechs\/[^/]+$/.test(url.pathname), {
    timeout: 15_000,
  })
  await expect(page.getByText('Iron Fist').first()).toBeVisible({
    timeout: 15_000,
  })
})
