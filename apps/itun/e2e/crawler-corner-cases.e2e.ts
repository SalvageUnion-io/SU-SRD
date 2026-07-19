import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases (WizShell flow: Crawler -> Systems -> Crew ->
 * Identity -> Review):
 *  - The CTA is gated: disabled on the Crawler step until a crawler type OptRow
 *    is picked, disabled again on Identity until a name is entered.
 *  - The Systems step reveals the Sel grid (new crawlers are fixed at TL1, so
 *    the offer is the TL1-and-below systems; tech level is raised later on the
 *    live sheet, not in the wizard).
 *
 * Crawler types render as native OptRow <button>s in the 320px master pane —
 * accessible name includes the type name ('Augmented' … 'Trade Caravan').
 * Systems render as Sel-wrapped `<div role="button">` cards, so
 * `div[role="button"]` counts only system cards, never the nav buttons. The
 * primary CTA is labelled from the steps array ('Next · Systems →' etc.) and
 * matched via the /^Next ·/ prefix.
 */

test('wizard gates progress until type + name are set', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Crawler step — CTA disabled until a crawler type is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Battle')
  await expect(next).toBeEnabled()

  // Crawler -> Systems -> Crew -> Identity
  await clickNext(page)
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

test('Systems step reveals the Sel grid for a new (TL1) crawler', async ({ page }) => {
  await page.goto('/crawlers/new')
  await waitForReady(page)

  // Crawler step -> pick a type -> advance to Systems.
  await pickByName(page, 'Battle')
  await clickNext(page)

  // At least one system Sel card (div[role="button"]) should be visible.
  await expect(page.locator('div[role="button"]').first()).toBeVisible()
})
