import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Dashboard delete flow: create a pilot, confirm the delete dialog, verify
 * the pilot disappears. Catches regressions in DeleteConfirmDialog and the
 * EntityListItem delete button cursor / focus wiring.
 */
test('create then delete a pilot from the dashboard', async ({ page }) => {
  // Build a quick pilot first.
  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await pickByName(page, 'Engineering Expertise')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.locator('div[role="button"]').first().click()
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByLabel(/^Name/).fill('Delete Me')
  await page.getByLabel(/Callsign/).fill('TBD')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /Create Pilot/i }).click()

  await page.waitForURL(/\/(pilots\/|$)/)
  await expect(page.getByText('Delete Me').first()).toBeVisible({ timeout: 15_000 })

  // Trigger delete from the dashboard
  await page.goto('/')
  await waitForReady(page)
  const deleteButton = page
    .getByRole('button', { name: /Delete Delete Me/i })
    .or(page.getByRole('button', { name: /^Delete$/ }).first())
  await deleteButton.first().click()

  // Confirm dialog
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Delete Delete Me\?/i)).toBeVisible()

  await page.getByRole('button', { name: /^Delete$/ }).click()

  // The pilot should vanish.
  await expect(page.getByText('Delete Me')).not.toBeVisible({ timeout: 10_000 })
})

test('cancel delete keeps the pilot visible', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByLabel(/^Name/).fill('Keep Me')
  await page.getByLabel(/Callsign/).fill('OK')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /Create Pilot/i }).click()
  await page.waitForURL(/\/(pilots\/|$)/)

  await page.goto('/')
  await waitForReady(page)
  await page
    .getByRole('button', { name: /Delete Keep Me/i })
    .or(page.getByRole('button', { name: /^Delete$/ }).first())
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Cancel keeps the entity
  await page.getByRole('button', { name: /Cancel/ }).click()
  await expect(page.getByText('Keep Me').first()).toBeVisible()
})
