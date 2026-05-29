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
 * This file is intentionally not in the main CI test matrix — it's a
 * one-shot capture helper. Run with:
 *   CI=1 bunx playwright test --project=chromium --workers=1 --retries=0 e2e/capture-shots.e2e.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

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
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false })
}

test('capture sheet + detail route screenshots', async ({ page }) => {
  // ----------------------------------------------------------------
  // 1. Build a pilot so we have an entity to view
  // ----------------------------------------------------------------
  await page.goto('/pilots/new')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Abilities step — pick first available
  await page.locator('div[role="button"]').first().click()
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Equipment step — pick first available
  await page.locator('div[role="button"]').first().click()
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Identity
  await page.getByLabel(/^Name/).fill('Test Pilot')
  await page.getByLabel(/Callsign/).fill('Tester')
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Background (skip)
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Create
  await page.getByRole('button', { name: /Create Pilot/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // ----------------------------------------------------------------
  // 2. Navigate to the detail route and capture screenshots
  // ----------------------------------------------------------------
  await page.goto('/')
  await waitForReady(page)

  // Find the pilot's name link to get its ID
  await expect(page.getByText('Test Pilot').first()).toBeVisible({ timeout: 15_000 })

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
  await expect(page.getByText('Test Pilot').first()).toBeVisible({ timeout: 15_000 })

  const sheetLink = page.getByRole('link', { name: /^Sheet$/i }).first()
  await sheetLink.click()
  await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
  await waitForReady(page)

  // Desktop + mobile for single-entity sheet
  await shot(page, 'sheet-pilot-single-desktop-1440', 1440)
  await shot(page, 'sheet-pilot-single-mobile-375', 375)

  // ----------------------------------------------------------------
  // 4. Build a mech, wire pilot to mech, capture wired sheet
  // ----------------------------------------------------------------
  await page.goto('/mechs/new')
  await waitForReady(page)
  await pickByName(page, 'Mule')
  await page.getByLabel(/Mech name/i).fill('Iron Fist')
  await page.getByRole('button', { name: /Create Mech/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // Navigate to pilot detail to wire pilot → mech link
  // The EntityListItem renders a "View" link for the detail route (not the name).
  await page.goto('/')
  await waitForReady(page)
  await expect(page.getByText('Test Pilot').first()).toBeVisible({ timeout: 15_000 })
  // Use the first "View" link (pilots section appears first on the dashboard)
  const pilotDetailLink = page.getByRole('link', { name: /^View$/ }).first()
  await pilotDetailLink.click()
  await page.waitForURL(/\/pilots\//, { timeout: 10_000 })
  await waitForReady(page)

  // Look for a wire/link control — if it exists, wire the mech
  const wireMechBtn = page
    .getByRole('button', { name: /wire|link|mech/i })
    .or(page.getByRole('combobox', { name: /mech/i }))
    .first()
  const wireMechVisible = await wireMechBtn.isVisible().catch(() => false)
  if (wireMechVisible) {
    await wireMechBtn.click()
    // Try to select Iron Fist from a dropdown or list
    const ironFistOption = page.getByText('Iron Fist').first()
    const optionVisible = await ironFistOption.isVisible().catch(() => false)
    if (optionVisible) await ironFistOption.click()
  }

  // Now navigate to the pilot's sheet
  await page.goto('/')
  await waitForReady(page)
  const wiredSheetLink = page.getByRole('link', { name: /^Sheet$/i }).first()
  await wiredSheetLink.click()
  await page.waitForURL(/\/sheet\//, { timeout: 10_000 })
  await waitForReady(page)

  await shot(page, 'sheet-wired-desktop-1440', 1440)
  await shot(page, 'sheet-wired-mobile-375', 375)
})
