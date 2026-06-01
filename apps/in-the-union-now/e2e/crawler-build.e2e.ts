import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Crawler-only build — steps through the wizard (Tech Level -> Loadout ->
 * Identity -> Review) and submits. The TechLevelSelector is a bespoke
 * `<button>` grid (not EntityChoiceCard since TLs aren't entities).
 *
 * The Next button is matched with `exact: true` because system cards are
 * role=button and some contain "next" in their body text.
 */
test('build a crawler from scratch', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Step 1 — Tech Level. TL 1 is always present at character creation.
  await page.getByRole('button', { name: /TL 1/i }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 2 — Loadout (bays/systems optional)
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 3 — Identity
  await page.getByLabel(/Crawler name/i).fill('Iron Wagon')
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // Step 4 — Review -> create
  await page.getByRole('button', { name: /Create Crawler/i }).click()

  await page.waitForURL(/\/(crawlers\/|$)/, { timeout: 15_000 })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({ timeout: 15_000 })
})
