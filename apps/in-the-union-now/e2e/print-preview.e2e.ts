import { test, expect } from '@playwright/test'
import { buildPilot, openSheetFor } from './_helpers'

/**
 * Print preview — A4 and US Letter, against the Header C LiveSheet shell.
 *
 * Builds a pilot, opens the live sheet, then verifies the existing A4 print
 * stylesheet still renders the new markup acceptably. Playwright exposes
 * `emulateMedia({ media: 'print' })` to switch the CSS media query.
 *
 * Real print fidelity is a maintainer-reviewed checkpoint — these tests
 * verify the stylesheet doesn't catastrophically hide content (hero name,
 * class chip, trackable stat pips) and that chrome (top-bar links) IS
 * hidden, not pixel-level layout.
 */
test.describe('sheet print preview', () => {
  test.beforeEach(async ({ page }) => {
    // This spec's beforeEach pays two full cold page-loads (buildPilot +
    // openSheetFor), so triple Playwright's time budget for the whole test.
    test.slow()
    await buildPilot(page, 'Print Test', 'PT')
    await openSheetFor(page, 'Print Test')
  })

  test('renders critical content under print @ A4', async ({ page }) => {
    // A4: 794 × 1123 CSS px at 96dpi
    await page.setViewportSize({ width: 794, height: 1123 })
    await page.emulateMedia({ media: 'print' })

    // The pilot's name should be visible in print (LiveSheet hero <h1>).
    // #334's print CSS hides the <header>, whose condensed copy of the name is
    // a <span>; role=heading targets the visible hero <h1> and dodges it.
    await expect(page.getByRole('heading', { name: 'Print Test' })).toBeVisible()
    // The class chip should also render — scope to the hero region landmark
    // (`<section aria-label="… sheet header">`) so we hit the visible MChip,
    // not any duplicate outside the hero.
    await expect(
      page.getByRole('region', { name: /sheet header/i }).getByText('Engineer')
    ).toBeVisible()
    // Stat pips keep their print hooks (filled pips survive the bg reset).
    expect(await page.locator('[data-pip]').count()).toBeGreaterThan(0)
    // Top-bar navigation is hidden under print (`header a` rule).
    await expect(page.getByRole('link', { name: /back to dashboard/i })).toBeHidden()
    await expect(page.getByRole('link', { name: /edit this pilot/i })).toBeHidden()
  })

  test('renders critical content under print @ US Letter', async ({ page }) => {
    // US Letter: 816 × 1056 CSS px at 96dpi
    await page.setViewportSize({ width: 816, height: 1056 })
    await page.emulateMedia({ media: 'print' })

    await expect(page.getByRole('heading', { name: 'Print Test' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: /sheet header/i }).getByText('Engineer')
    ).toBeVisible()
  })
})
