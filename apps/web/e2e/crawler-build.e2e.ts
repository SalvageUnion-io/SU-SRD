import type { Page } from '@playwright/test'
import { at } from './_base'
import {
  addFromSearcher,
  advanceUntilVisible,
  editSheet,
  fillIdentity,
  pickByName,
  waitForReady,
} from './_helpers'
import { expect, test } from './fixtures'

/**
 * Drive the wizard to a created 'Iron Wagon'. Three steps gate — Crawler Type,
 * Armament Bay (at least one weapon) and Name — and everything between them is
 * informational, so each is reached by its own content rather than by counting
 * Next clicks.
 */
async function buildIronWagon(page: Page): Promise<void> {
  await page.goto(at('/crawlers/new?mode=guided'))
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
  await page.waitForURL((url) => url.pathname === at('/'), { timeout: 15_000 })
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
 * Crawler edit round-trip. The live sheet is the Free Edit surface (ADR-021):
 * you edit in place. What matters is that the crawler can be changed after
 * creation and that the change persists.
 */
test('arm a crawler further from its live sheet', async ({ page }) => {
  await buildIronWagon(page)

  // Open the crawler's live sheet from its roster row.
  // Matched on `href`, not the label. The shelf item's pill (`ShelfItem`) is
  // the link to the sheet, and its accessible name is the whole pill (stamp,
  // name, reading), so no label match is stable. The href is the contract
  // that matters and it survives the next copy change, as `openSheetFor` in
  // `_helpers.ts` does.
  await page.locator('li', { hasText: 'Iron Wagon' }).locator('a[href*="/sheet/"]').click()
  await page.waitForURL(/\/sheet\/crawler\//, { timeout: 15_000 })
  await waitForReady(page)

  // The Armament Bay card's function control opens CrawlerSystemsEditModal.
  // Each bay carries a verb rather than a generic add (BAY_FUNCTIONS in
  // CrawlerSheetItems: Dock / Craft / Heal / Mount…), so the armament bay's
  // control is labelled 'Mount' — that verb IS "open the weapons picker".
  // The picker is the searcher: open a weapon from its list, add it from its
  // Page (`addFromSearcher`). A sheet opens in Read; its controls are Edit's.
  await editSheet(page)
  await page.getByRole('button', { name: /^Mount$/i }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()
  await addFromSearcher(picker, 'Chainsaw Arm')
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()

  // The bay's new weapon is the write-through's visible effect, and it
  // survives a reload (the server, same record — no duplicate crawler).
  await expect(page.getByText('Chainsaw Arm').first()).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Chainsaw Arm').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({ timeout: 15_000 })
})
