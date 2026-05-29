import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases:
 *  - Submit with empty name is blocked by the name input's native `required`
 *    constraint (the Create button is always enabled; the browser blocks the
 *    submit, so no crawler is created and the field is marked invalid).
 *  - Initial render shows "Select a tech level to see available systems."
 *  - Picking TL 1 (Hamlet Crawler) reveals at least one system card.
 *  - Switching from TL 1 to TL 6 (Megacity Crawler) exposes more systems.
 *
 * TL selector: each option is a <button> whose accessible name is
 * "TL {n} {tier-name}" — e.g. "TL 1 Hamlet Crawler", "TL 6 Megacity Crawler".
 * Systems render as EntityChoiceCard roots: <div role="button">.
 */

test('Create Crawler is blocked when the name is empty', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // The Create button is always enabled; the name input guards via native `required`.
  const createBtn = page.getByRole('button', { name: /Create Crawler/i })
  await expect(createBtn).toBeEnabled()

  // Submitting with an empty name is blocked by the browser's native `required`
  // validation — the form never submits, so no crawler is created, we stay on
  // the builder, and the name field reports invalid.
  await createBtn.click()
  await expect(page).toHaveURL(/\/crawlers\/new/)
  await expect(page.locator('#crawler-name')).toHaveJSProperty('validity.valid', false)

  // Once a name is provided the field becomes valid.
  await page.getByLabel(/Crawler Name/i).fill('Wagon')
  await expect(page.locator('#crawler-name')).toHaveJSProperty('validity.valid', true)
})

test('TL gating reveals systems list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Before any TL is selected the prompt is shown.
  await expect(page.getByText(/Select a tech level to see available systems/i)).toBeVisible()

  // Click "TL 1 Hamlet Crawler" — the button whose name contains "TL 1".
  await page.getByRole('button', { name: /TL 1 Hamlet Crawler/i }).click()
  await expect(page.getByText(/Select a tech level to see available systems/i)).not.toBeVisible()

  // At least one EntityChoiceCard (div[role="button"]) should now be visible.
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
})

test('raising TL adds more systems to the list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Select TL 1 (Hamlet Crawler) and wait for systems to render.
  await page.getByRole('button', { name: /TL 1 Hamlet Crawler/i }).click()
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
  const tl1Count = await page.locator('div[role="button"]').count()

  // TL 6 (Megacity Crawler) is the highest tier; it exposes all numeric-TL
  // systems (techLevel <= 6), so strictly more than TL 1's cumulative set.
  await page.getByRole('button', { name: /TL 6 Megacity Crawler/i }).click()
  // Wait for the list to update before counting.
  await expect(page.locator('div[role="button"]').nth(tl1Count)).toBeVisible()
  const tl6Count = await page.locator('div[role="button"]').count()

  expect(tl6Count).toBeGreaterThan(tl1Count)
})
