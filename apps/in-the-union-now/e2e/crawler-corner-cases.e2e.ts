import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases (WizShell flow: Crawler -> Systems -> Identity
 * -> Review):
 *  - The CTA is gated: disabled on the Crawler step until a tech level OptRow
 *    is picked, disabled again on Identity until a name is entered.
 *  - The Systems step reveals the Sel grid for the chosen TL.
 *  - Raising the TL (via Back) exposes more systems.
 *
 * Tech levels render as native OptRow <button>s in the 320px master pane —
 * accessible name includes the TL name ('Hamlet Crawler' … 'Megacity
 * Crawler'). Systems render as Sel-wrapped `<div role="button">` cards, so
 * `div[role="button"]` counts only system cards, never the nav buttons. The
 * primary CTA is labelled from the steps array ('Next · Systems →' etc.) and
 * matched via the /^Next ·/ prefix.
 */

test('wizard gates progress until TL + name are set', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Crawler step — CTA disabled until a tech level is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Hamlet Crawler')
  await expect(next).toBeEnabled()

  // Crawler -> Systems -> Identity
  await clickNext(page)
  await clickNext(page)

  // Identity step — CTA disabled until a name is entered.
  await expect(page.getByRole('button', { name: /^Next ·/ })).toBeDisabled()
  await page.getByLabel(/Crawler Name/i).fill('Wagon')
  await expect(page.getByRole('button', { name: /^Next ·/ })).toBeEnabled()

  // Identity -> Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Crawler/i })).toBeEnabled()
})

test('Systems step reveals the Sel grid for the chosen TL', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Crawler step -> pick TL 1 -> advance to Systems.
  await pickByName(page, 'Hamlet Crawler')
  await clickNext(page)

  // At least one system Sel card (div[role="button"]) should be visible.
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
})

test('raising TL adds more systems to the list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // TL 1 -> Systems, count system cards.
  await pickByName(page, 'Hamlet Crawler')
  await clickNext(page)
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
  const tl1Count = await page.locator('div[role="button"]').count()

  // Back to the Crawler step, raise to TL 6 (Megacity), return to Systems.
  await page.getByRole('button', { name: /^Back$/ }).click()
  await pickByName(page, 'Megacity Crawler')
  await clickNext(page)
  await expect(page.locator('div[role="button"]').nth(tl1Count)).toBeVisible()
  const tl6Count = await page.locator('div[role="button"]').count()

  expect(tl6Count).toBeGreaterThan(tl1Count)
})
