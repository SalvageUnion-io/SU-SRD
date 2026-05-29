import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Regression guard: selecting a class on Step 1 must enable the Next button.
 *
 * The previous ClassStep rendered ClassAbilityTreeDisplay below the grid,
 * which mounted a useDetailModal hook per ability. A render-time failure
 * inside that listing could leave the wizard stuck on Class step with no
 * way to advance. The new ClassStep keeps the abilities inline per card,
 * uses raw ReferenceEntityDisplay (no detail-modal hooks), and so this
 * regression should not recur.
 */
test('Next is disabled before class pick and enabled after', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next$/ })
  await expect(next).toBeDisabled()

  await pickByName(page, 'Engineer')
  await expect(next).toBeEnabled()

  // And clicking Next actually advances to the Abilities step.
  await next.click()
  await expect(page.getByRole('heading', { name: /Choose Starting Abilities/i })).toBeVisible()
})

test('every class card exposes a Show abilities disclosure', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Each base class should render a "Show abilities (N)" summary.
  const disclosures = page.getByText(/Show abilities \(\d+\)/)
  // SU core book has at least 6 base classes; allow for new sources to add
  // more without breaking this assertion.
  expect(await disclosures.count()).toBeGreaterThanOrEqual(6)
})

test('opening the Engineer disclosure shows ability descriptions inline', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Find the disclosure inside the Engineer card and open it.
  const engineerCardContainer = page
    .locator('div')
    .filter({ hasText: /^Engineer$/ })
    .first()
  // Click any Show abilities summary in that container.
  await engineerCardContainer
    .locator('summary')
    .first()
    .click()
    .catch(async () => {
      // Fall back to a global click on the first "Show abilities" summary.
      await page
        .getByText(/Show abilities/)
        .first()
        .click()
    })

  // After opening, the SRD ability rules text for Engineering Expertise
  // should be visible inline (without leaving the wizard).
  await expect(page.getByText(/Engineering Expertise/).first()).toBeVisible()
})
