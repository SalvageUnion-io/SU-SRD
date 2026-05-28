import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases:
 *  - Submit disabled with no name.
 *  - Initial render shows "Select a tech level to see available systems."
 *  - Picking TL 1 reveals at least one TL-1 system.
 *  - Switching from TL 1 to a higher TL changes the systems list (more
 *    systems become available).
 */

test('Create Crawler is disabled with empty name', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)
  await expect(page.getByRole('button', { name: /Create Crawler/i })).toBeDisabled()

  // Setting just the name without a TL is still allowed (TL is required for
  // systems but the rule layer treats it as optional at submit time).
  await page.getByLabel(/Crawler name/i).fill('Wagon')
  await expect(page.getByRole('button', { name: /Create Crawler/i })).toBeEnabled()
})

test('TL gating reveals systems list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  await expect(page.getByText(/Select a tech level to see available systems/i)).toBeVisible()

  await page.getByRole('button', { name: /^TL 1$/ }).click()
  await expect(page.getByText(/Select a tech level to see available systems/i)).not.toBeVisible()

  // At least one EntityChoiceCard should now render for TL-1 systems.
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
})

test('raising TL adds more systems to the list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  await page.getByRole('button', { name: /^TL 1$/ }).click()
  const tl1Count = await page.locator('div[role="button"]').count()

  // TL 6 (max in core SU) should expose strictly more systems than TL 1.
  await page.getByRole('button', { name: /^TL 6$/ }).click()
  const tl6Count = await page.locator('div[role="button"]').count()

  expect(tl6Count).toBeGreaterThan(tl1Count)
})
