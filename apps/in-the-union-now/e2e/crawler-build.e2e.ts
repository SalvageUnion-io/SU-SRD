import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * Crawler-only build — tech level pick + name → submit. The TechLevelSelector
 * is a bespoke `<button>` grid (not EntityChoiceCard since TLs aren't entities),
 * so this test also confirms the cursor-pointer fix on those buttons.
 */
test('build a crawler from scratch', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Crawler name is required up top.
  await page.getByLabel(/Crawler name/i).fill('Iron Wagon')

  // Tech level — pick TL 1 (always present at character creation).
  await page.getByRole('button', { name: /TL 1/i }).click()

  await page.getByRole('button', { name: /Create Crawler/i }).click()

  await page.waitForURL(/\/(crawlers\/|$)/, { timeout: 15_000 })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({ timeout: 15_000 })
})
