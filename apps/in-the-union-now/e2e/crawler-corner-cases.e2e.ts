import { test, expect } from '@playwright/test'
import { waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases (Tech Level -> Loadout -> Identity -> Review
 * stepper wizard):
 *  - Next is gated: disabled on Tech Level until a TL is chosen, disabled again
 *    on Identity until a name is entered.
 *  - The Loadout step reveals the systems list for the chosen TL.
 *  - Raising the TL (via Back) exposes more systems.
 *
 * TL selector: each option is a <button> whose accessible name is
 * "TL {n} {tier-name}" — e.g. "TL 1 Hamlet Crawler", "TL 6 Megacity Crawler".
 * Systems render as EntityChoiceCard roots: <div role="button">. The Next nav
 * button is matched with `exact: true` so card text containing "next" / "TL"
 * does not collide with it.
 */

test('wizard gates progress until TL + name are set', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: 'Next', exact: true })

  // Tech Level step — Next disabled until a TL is chosen.
  await expect(next).toBeDisabled()
  await page.getByRole('button', { name: /TL 1 Hamlet Crawler/i }).click()
  await expect(next).toBeEnabled()

  // Tech Level -> Loadout -> Identity
  await next.click()
  await next.click()

  // Identity step — Next disabled until a name is entered.
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByLabel(/Crawler Name/i).fill('Wagon')
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()

  // Identity -> Review — Create is enabled.
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('button', { name: /Create Crawler/i })).toBeEnabled()
})

test('Loadout step reveals the systems list for the chosen TL', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Tech Level -> pick TL 1 -> advance to Loadout.
  await page.getByRole('button', { name: /TL 1 Hamlet Crawler/i }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()

  // At least one system EntityChoiceCard (div[role="button"]) should be visible.
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
})

test('raising TL adds more systems to the list', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // TL 1 -> Loadout, count systems.
  await page.getByRole('button', { name: /TL 1 Hamlet Crawler/i }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
  const tl1Count = await page.locator('div[role="button"]').count()

  // Back to Tech Level, raise to TL 6 (Megacity Crawler), return to Loadout.
  await page.getByRole('button', { name: /^Back$/ }).click()
  await page.getByRole('button', { name: /TL 6 Megacity Crawler/i }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('div[role="button"]').nth(tl1Count)).toBeVisible()
  const tl6Count = await page.locator('div[role="button"]').count()

  expect(tl6Count).toBeGreaterThan(tl1Count)
})
