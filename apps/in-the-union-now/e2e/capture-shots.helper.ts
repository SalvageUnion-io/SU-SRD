/**
 * Screenshot capture for phase-4 responsive review.
 *
 * Captures desktop (1440×900) + mobile (375×812) screenshots of:
 *   - Sheet (single-entity pilot + wired pilot-mech)
 *   - Detail route (pilots/$id)
 *
 * These supplement the dashboard + crawler-builder shots already captured.
 * Output goes to apps/in-the-union-now/.tmp-shots/
 *
 * This file is intentionally not in the main CI test matrix — it uses the
 * `.helper.ts` extension so it does not match the `*.e2e.ts` testMatch glob.
 * Run manually with:
 *   CI=1 bunx playwright test --project=chromium --workers=1 --retries=0 e2e/capture-shots.helper.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SHOTS_DIR = path.resolve(__dirname, '../.tmp-shots')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

async function shot(
  page: import('@playwright/test').Page,
  name: string,
  width: number,
  height = 900
) {
  ensureDir(SHOTS_DIR)
  await page.setViewportSize({ width, height })
  // Brief settle after viewport change
  await page.waitForTimeout(300)
  await page.screenshot({
    path: path.join(SHOTS_DIR, `${name}.png`),
    fullPage: false,
  })
}

test('capture sheet + detail route screenshots', async ({ page }) => {
  // ----------------------------------------------------------------
  // 1. Build a pilot so we have an entity to view
  // ----------------------------------------------------------------
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Class -> Abilities -> Equipment -> Identity -> Background -> Review
  await pickByName(page, 'Engineer')
  await clickNext(page) // -> Abilities

  // Abilities step — pick first available
  await page.locator('div[role="button"]').first().click()
  await clickNext(page) // -> Equipment

  // Equipment step — pick first available
  await page.locator('div[role="button"]').first().click()
  await clickNext(page) // -> Identity

  // Identity
  await page.getByLabel(/^Name/).fill('Test Pilot')
  await page.getByLabel(/Callsign/).fill('Tester')
  await clickNext(page) // -> Background

  // Background (skip)
  await clickNext(page) // -> Review

  // Review -> create
  await page.getByRole('button', { name: /Create Pilot/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // ----------------------------------------------------------------
  // 2. Navigate to the detail route and capture screenshots
  // ----------------------------------------------------------------
  await page.goto('/')
  await waitForReady(page)

  // Find the pilot's name link to get its ID
  await expect(page.getByText('Test Pilot').first()).toBeVisible({
    timeout: 15_000,
  })

  // The EntityListItem renders a "View" link for the detail route.
  // We grab the first "View" link in the pilots section (it's the first on the page).
  const pilotLink = page.getByRole('link', { name: /^View$/ }).first()
  await pilotLink.click()
  await page.waitForURL(/\/pilots\//, { timeout: 10_000 })
  await waitForReady(page)

  // Desktop + mobile for detail route
  await shot(page, 'pilot-detail-desktop-1440', 1440)
  await shot(page, 'pilot-detail-mobile-375', 375)

  // ----------------------------------------------------------------
  // 3. Navigate to the sheet route and capture screenshots
  // ----------------------------------------------------------------
  // Go back to dashboard and use the Sheet link
  await page.goto('/')
  await waitForReady(page)
  await expect(page.getByText('Test Pilot').first()).toBeVisible({
    timeout: 15_000,
  })

  const sheetLink = page.getByRole('link', { name: /^Sheet$/i }).first()
  await sheetLink.click()
  await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
  await waitForReady(page)

  // Desktop + mobile for single-entity sheet
  await shot(page, 'sheet-pilot-single-desktop-1440', 1440)
  await shot(page, 'sheet-pilot-single-mobile-375', 375)

  // ----------------------------------------------------------------
  // 4. Build a mech, wire pilot → mech via the mech detail page,
  //    then capture the wired sheet
  // ----------------------------------------------------------------
  // Chassis -> Systems -> Modules -> Identity -> Review
  await page.goto('/mechs/new')
  await waitForReady(page)
  await pickByName(page, 'Mule')
  await clickNext(page) // -> Systems
  await clickNext(page) // -> Modules
  await clickNext(page) // -> Identity
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Mech/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // Navigate to the mech detail page.
  // On the dashboard the mechs section "View" links appear after the pilots section,
  // so we use getByRole with exact text and filter to the one that links to /mechs/.
  await page.goto('/')
  await waitForReady(page)
  await expect(page.getByText('Iron Fist').first()).toBeVisible({
    timeout: 15_000,
  })

  // Navigate to the mech detail page.
  // "Iron Fist" text is rendered as a link in EntityListItem; use it directly.
  // If it's not a link, fall back to the second "View" link (pilot is first).
  const ironFistLink = page.getByRole('link', { name: 'Iron Fist' }).first()
  const ironFistIsLink = await ironFistLink.isVisible().catch(() => false)
  if (ironFistIsLink) {
    await ironFistLink.click()
  } else {
    // pilot "View" is first, mech "View" is second on the dashboard
    await page
      .getByRole('link', { name: /^View$/ })
      .nth(1)
      .click()
  }
  await page.waitForURL(/\/mechs\//, { timeout: 10_000 })
  await waitForReady(page)

  // Assign the pilot to this mech via the "Assign Pilot" button
  const assignPilotBtn = page.getByRole('button', { name: /Assign Pilot/i })
  await expect(assignPilotBtn).toBeVisible({ timeout: 10_000 })
  await assignPilotBtn.click()

  // In the dialog, select "Test Pilot" radio (wrapped in a <label>) and confirm.
  // The dialog is a div[role="dialog"] labeled via aria-labelledby; radio inputs
  // are labelled by their wrapping <label> element's text content.
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5_000 })
  // Click the label containing "Test Pilot" to select the radio
  await page.locator('[role="dialog"] label', { hasText: 'Test Pilot' }).click()
  // Click the confirm button (aria-label="Confirm pilot assignment")
  await page.getByRole('button', { name: /Confirm pilot assignment/i }).click()

  // Wait for dialog to close (URL may refresh to same mech detail)
  await page.waitForTimeout(1_000)

  // Now navigate to the pilot's sheet (pilot is still the primary wired entity)
  await page.goto('/')
  await waitForReady(page)
  await expect(page.getByText('Test Pilot').first()).toBeVisible({
    timeout: 15_000,
  })
  const wiredSheetLink = page.getByRole('link', { name: /^Sheet$/i }).first()
  await wiredSheetLink.click()
  await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
  await waitForReady(page)

  await shot(page, 'sheet-wired-desktop-1440', 1440)
  await shot(page, 'sheet-wired-mobile-375', 375)
})
