import { at } from './_base'
import {
  addThroughPicker,
  advanceUntilVisible,
  buildCrawler,
  clickNext,
  fillIdentity,
  openSheetFor,
  openWizard,
  optionCells,
  pickByName,
  unselectedOptions,
  waitForReady,
} from './_helpers'
import { expect, test } from './fixtures'

/**
 * The crawler wizard (`/crawlers/new`), one file per wizard: the build end to
 * end and its edit on the live sheet, then the corner cases.
 */

/**
 * Crawler build — steps through the crawler wizard and submits, then arms the
 * created crawler from its live sheet.
 *
 * The wizard is Crawler Type → Statistics → Armament Bay → Crew → Name →
 * Review. Its name is a click-to-edit control ("Edit crawler name"), not a
 * labelled `Crawler Name` input.
 *
 * Tech level is fixed at TL1 on create; bays are not chosen — every crawler
 * seeds the full SRD bay set on creation.
 */
test('build a crawler from scratch', async ({ page }) => {
  await openWizard(page, 'crawlers')

  // Crawler Type — one entity card per type. Three steps gate (type, a
  // weapon, a name); the rest are informational, so each is reached by its
  // own content rather than by counting Next clicks.
  await pickByName(page, 'Battle')

  // Armament Bay — gated until the bay holds a weapon. The offered weapons
  // depend on the crawler's tech level, so take the first on offer instead of
  // naming one.
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))
  const weapon = unselectedOptions(page).first()
  await expect(weapon).toBeVisible()
  await weapon.click()

  // Name.
  const nameEditor = page.getByLabel(/^Edit crawler name$/i)
  await advanceUntilVisible(page, nameEditor)
  await fillIdentity(page, 'crawler name', 'Iron Wagon')

  const createCrawler = page.getByRole('button', { name: /Create Crawler/i })
  await advanceUntilVisible(page, createCrawler)
  await createCrawler.click()
  await page.waitForURL((url) => url.pathname === at('/'), { timeout: 15_000 })
  await waitForReady(page)
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
  await buildCrawler(page, 'Iron Wagon')
  await openSheetFor(page, 'Iron Wagon')

  // Each bay carries a verb rather than a generic add (BAY_FUNCTIONS in
  // CrawlerSheetItems: Dock / Craft / Heal / Mount…), so the Armament Bay's
  // control is 'Mount': that verb IS "open the weapons picker".
  await addThroughPicker(page, /^Mount$/i, 'Chainsaw Arm')

  // The bay's new weapon is the write-through's visible effect, and it
  // survives a reload (the server, same record — no duplicate crawler).
  await expect(page.getByText('Chainsaw Arm').first()).toBeVisible({ timeout: 15_000 })

  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Chainsaw Arm').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Iron Wagon').first()).toBeVisible({ timeout: 15_000 })
})

/**
 * CrawlerWizard corner cases. The wizard is Crawler Type → Statistics →
 * Armament Bay → Crew → Name → Review; three steps gate (type, at least one
 * weapon, a name) and the rest are informational.
 *
 * The name is a click-to-edit control ("Edit crawler name"), and the systems
 * grid is the Armament Bay step. Steps are reached by their content rather than by counting Next clicks, so an
 * inserted step does not strand these assertions on the wrong screen.
 *
 * Crawler types render as `ReferenceEntityCard` radio cells (role="radio",
 * aria-checked) whose accessible name is the type name ('Augmented' … 'Trade
 * Caravan') — `pickByName` matches radios as well as buttons.
 */

test('wizard gates progress until type, armament and name are set', async ({ page }) => {
  await openWizard(page, 'crawlers')

  const next = page.getByRole('button', { name: /^Next: / })

  // Crawler Type — CTA disabled until a type is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Battle')
  await expect(next).toBeEnabled()

  // Armament Bay — gated until the bay holds a weapon.
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))
  await expect(next).toBeDisabled()
  const weapon = unselectedOptions(page).first()
  await expect(weapon).toBeVisible()
  await weapon.click()
  await expect(next).toBeEnabled()

  // Name — gated until the crawler is named.
  const nameEditor = page.getByLabel(/^Edit crawler name$/i)
  await advanceUntilVisible(page, nameEditor)
  await expect(next).toBeDisabled()
  await fillIdentity(page, 'crawler name', 'Wagon')
  await expect(next).toBeEnabled()

  // Name -> Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Crawler/i })).toBeEnabled()
})

test('the Armament Bay offers weapons for a new (TL1) crawler', async ({ page }) => {
  await openWizard(page, 'crawlers')

  await pickByName(page, 'Battle')
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))

  // New crawlers are fixed at TL1, so the offer is the TL1-and-below weapon
  // systems; tech level is raised later on the live sheet, not in the wizard.
  // Assert on selectable cells rather than `div[role="button"]`, which counts
  // whatever happens to be rendered as a div-button anywhere on the page.
  const options = optionCells(page)
  await expect(options.first()).toBeVisible()
  expect(await options.count()).toBeGreaterThan(0)
})
