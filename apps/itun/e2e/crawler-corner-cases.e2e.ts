import { expect, test } from '@playwright/test'
import { advanceUntilVisible, clickNext, fillIdentity, pickByName, waitForReady } from './_helpers'

/**
 * CrawlerBuilder corner cases. The wizard is Crawler Type → Statistics →
 * Armament Bay → Crew → Name → Review; three steps gate (type, at least one
 * weapon, a name) and the rest are informational.
 *
 * This previously described a Crawler → Systems → Crew → Identity flow and
 * filled a labelled `Crawler Name` input. The name is now a click-to-edit
 * control ("Edit crawler name"), and the systems grid is the Armament Bay step.
 * Steps are reached by their content rather than by counting Next clicks, so an
 * inserted step does not strand these assertions on the wrong screen.
 *
 * Crawler types render as `ReferenceEntityCard` radio cells (role="radio",
 * aria-checked) whose accessible name is the type name ('Augmented' … 'Trade
 * Caravan') — `pickByName` matches radios as well as buttons.
 */

test('wizard gates progress until type, armament and name are set', async ({ page }) => {
  await page.goto('/crawlers/new?mode=guided')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })

  // Crawler Type — CTA disabled until a type is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Battle')
  await expect(next).toBeEnabled()

  // Armament Bay — gated until the bay holds a weapon.
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))
  await expect(next).toBeDisabled()
  const weapon = page.locator('[aria-pressed="false"], [aria-checked="false"]').first()
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
  await page.goto('/crawlers/new?mode=guided')
  await waitForReady(page)

  await pickByName(page, 'Battle')
  await advanceUntilVisible(page, page.getByRole('heading', { name: /Arm the Armament Bay/i }))

  // New crawlers are fixed at TL1, so the offer is the TL1-and-below weapon
  // systems; tech level is raised later on the live sheet, not in the wizard.
  // Assert on selectable cells rather than `div[role="button"]`, which counts
  // whatever happens to be rendered as a div-button anywhere on the page.
  const options = page.locator('[aria-pressed], [aria-checked]')
  await expect(options.first()).toBeVisible()
  expect(await options.count()).toBeGreaterThan(0)
})
