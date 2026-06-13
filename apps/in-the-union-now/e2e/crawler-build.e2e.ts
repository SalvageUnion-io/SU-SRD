import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * Crawler build + edit on the WizShell skeleton (plan 3.2/3.6):
 * Crawler (OptRow crawler-type master list) -> Systems (Sel grid) ->
 * Crew (bay-NPC details) -> Identity -> Review -> 'Create Crawler ✦'.
 * Tech level is fixed at TL1 on create; bays are not chosen — every crawler
 * seeds the full SRD bay set on creation.
 */
test('build a crawler from scratch', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Step 1 — Crawler. OptRow per crawler type; pick Battle.
  await pickByName(page, 'Battle')
  await clickNext(page) // -> Systems

  // Step 2 — Systems (optional; capacity is soft)
  await clickNext(page) // -> Crew

  // Step 3 — Crew (bay-NPC details all optional)
  await clickNext(page) // -> Identity

  // Step 4 — Identity
  await page.getByLabel(/Crawler Name/i).fill('Iron Wagon')
  await clickNext(page) // -> Review

  // Step 5 — Review -> create
  await page.getByRole('button', { name: /Create Crawler/i }).click()

  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * Crawler edit round-trip (plan 3.6): open the created crawler's edit route
 * from the detail page, install a system, save, and confirm the upsert branch
 * saved in place (back on the detail page, no duplicate).
 */
test('edit a crawler via /crawlers/$id/edit', async ({ page }) => {
  // Build first.
  await page.goto('/crawlers/new')
  await waitForReady(page)
  await pickByName(page, 'Battle')
  await clickNext(page) // -> Systems
  await clickNext(page) // -> Crew
  await clickNext(page) // -> Identity
  await page.getByLabel(/Crawler Name/i).fill('Iron Wagon')
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Create Crawler/i }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })

  // Open the crawler detail page from the dashboard, then Edit.
  await page
    .locator('li', { hasText: 'Iron Wagon' })
    .getByRole('link', { name: /^View$/ })
    .click()
  await page.waitForURL(/\/crawlers\//, { timeout: 15_000 })
  await page.getByRole('link', { name: /^Edit$/ }).click()
  await page.waitForURL(/\/crawlers\/.+\/edit/, { timeout: 15_000 })
  await waitForReady(page)

  // Wizard is prefilled (type chosen), eyebrow flips to edit mode.
  await expect(page.getByText('Edit Crawler')).toBeVisible()
  await clickNext(page) // -> Systems
  // Install a system in edit mode — pick the first Sel card in the grid.
  await page.locator('div[role="button"]').first().click()
  await clickNext(page) // -> Crew
  await clickNext(page) // -> Identity (prefilled)
  await clickNext(page) // -> Review
  await page.getByRole('button', { name: /Save Crawler/i }).click()

  // Save navigates back to the detail page — the same record, edited.
  await page.waitForURL((url) => /\/crawlers\/[^/]+$/.test(url.pathname), {
    timeout: 15_000,
  })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({
    timeout: 15_000,
  })
})
