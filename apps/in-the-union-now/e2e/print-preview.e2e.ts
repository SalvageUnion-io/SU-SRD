import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Print preview — A4 and US Letter.
 *
 * Builds a pilot, navigates to the sheet, then verifies the print
 * stylesheet renders the critical elements at both page sizes. Playwright
 * exposes `emulateMedia({ media: 'print' })` to switch the CSS media query.
 *
 * Real print fidelity is a maintainer-reviewed checkpoint (per
 * ideate/milestones-data.md M2 DoD) — these tests verify the stylesheet
 * doesn't catastrophically hide content, not pixel-level layout.
 */
test.describe('sheet print preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await pickByName(page, 'Engineering Expertise')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.locator('div[role="button"]').first().click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByLabel(/^Name/).fill('Print Test')
    await page.getByLabel(/Callsign/).fill('PT')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /Create Pilot/i }).click()
    await page.waitForURL(/\/(pilots\/|$)/, { timeout: 15_000 })
    await page
      .getByRole('link', { name: /^Sheet$/i })
      .first()
      .click()
    await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
  })

  test('renders critical content under print @ A4', async ({ page }) => {
    // A4: 794 × 1123 CSS px at 96dpi
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.emulateMedia({ media: 'print' })

    // The pilot's name should be visible in print.
    await expect(page.getByText('Print Test').first()).toBeVisible()
    // The class block should also render.
    await expect(page.getByText('Engineer').first()).toBeVisible()
  })

  test('renders critical content under print @ US Letter', async ({ page }) => {
    // US Letter: 816 × 1056 CSS px at 96dpi
    await page.setViewportSize({ width: 816, height: 1056 })
    await page.emulateMedia({ media: 'print' })

    await expect(page.getByText('Print Test').first()).toBeVisible()
    await expect(page.getByText('Engineer').first()).toBeVisible()
  })
})
