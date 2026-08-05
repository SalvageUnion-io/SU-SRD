import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { advanceUntilVisible, fillIdentity, pickByName, waitForReady } from './_helpers'

/**
 * Drive the wizard to a created 'Iron Wagon'. Three steps gate — Crawler Type,
 * Armament Bay (at least one weapon) and Name — and everything between them is
 * informational, so each is reached by its own content rather than by counting
 * Next clicks.
 */
async function buildIronWagon(page: Page): Promise<void> {
  await page.goto('/crawlers/new?mode=guided')
  await waitForReady(page)

  // Crawler Type — one entity card per type.
  await pickByName(page, 'Battle')

  // Armament Bay — gated until the bay holds a weapon. The offered weapons
  // depend on the crawler's tech level, so take the first on offer instead of
  // naming one.
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))
  const weapon = page.locator('[aria-pressed="false"], [aria-checked="false"]').first()
  await expect(weapon).toBeVisible()
  await weapon.click()

  // Name — a click-to-edit control, not the labelled input this spec once used.
  const nameEditor = page.getByLabel(/^Edit crawler name$/i)
  await advanceUntilVisible(page, nameEditor)
  await fillIdentity(page, 'crawler name', 'Iron Wagon')

  const createCrawler = page.getByRole('button', { name: /Create Crawler/i })
  await advanceUntilVisible(page, createCrawler)
  await createCrawler.click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
  await waitForReady(page)
}

/**
 * Crawler build — steps through the crawler wizard and submits, then arms the
 * created crawler from its live sheet.
 *
 * The wizard is Crawler Type → Statistics → Armament Bay → Crew → Name →
 * Review. Only the Name step gates, and its field is a click-to-edit control
 * ("Edit crawler name"), not the labelled `Crawler Name` input this spec used
 * to fill. Walk to the steps by content rather than counting Next clicks, so
 * the next reshuffle does not silently strand this spec on the wrong step.
 *
 * Tech level is fixed at TL1 on create; bays are not chosen — every crawler
 * seeds the full SRD bay set on creation.
 */
test('build a crawler from scratch', async ({ page }) => {
  await buildIronWagon(page)
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * Crawler edit round-trip. /crawlers/$id is now a bare redirect and there is no
 * /crawlers/$id/edit route — the detail page was collapsed into the live sheet,
 * the Free Edit surface under ADR-021. Intent is unchanged: change the crawler
 * after creation and have the change persist.
 */
test('arm a crawler further from its live sheet', async ({ page }) => {
  await buildIronWagon(page)

  // Open the crawler's live sheet from its roster row.
  await page
    .locator('li', { hasText: 'Iron Wagon' })
    .getByRole('link', { name: /^View$/ })
    .click()
  await page.waitForURL(/\/sheet\/crawler\//, { timeout: 15_000 })
  await waitForReady(page)

  // The Armament Bay card's function control opens CrawlerSystemsEditModal.
  // Each bay carries a verb rather than a generic add (BAY_FUNCTIONS in
  // CrawlerSheetItems: Dock / Craft / Heal / Mount…), so the armament bay's
  // control is labelled 'Mount' — that verb IS "open the weapons picker".
  // The searcher runs in toggle mode: click the selectable cell, not its prose.
  await page.getByRole('button', { name: /^Mount$/i }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()
  const weapon = picker.locator('[aria-pressed="false"], [aria-checked="false"]').first()
  await expect(weapon).toBeVisible()
  await weapon.click()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()

  // The bay's installed count is the write-through's visible effect, and it
  // survives a reload (IndexedDB, same record — no duplicate crawler).
  await expect(page.getByText('No weapons mounted.')).toHaveCount(0)

  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('No weapons mounted.')).toHaveCount(0)
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({ timeout: 15_000 })
})
