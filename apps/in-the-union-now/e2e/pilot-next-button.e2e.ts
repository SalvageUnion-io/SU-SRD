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

  // Wait for at least one class card to be rendered before counting summaries,
  // ensuring game data has hydrated into the DOM (waitForReady guards the data
  // preload, but the cards may still be rendering their first paint).
  await expect(page.locator('details').first()).toBeVisible({ timeout: 15_000 })

  // Each base class card renders a native <details> with a <summary> reading
  // "Show abilities" (ClassAbilitiesSlot in ClassStep.tsx).
  // SU core book has 6 base classes; allow for new sources to add more.
  const disclosures = page.locator('details')
  expect(await disclosures.count()).toBeGreaterThanOrEqual(6)
})

test('opening the Engineer disclosure shows ability descriptions inline', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Wait for the Engineer card's <details> disclosure to be in the DOM.
  // The Engineer card is a div[role="button"] whose accessible text starts
  // with "Engineer"; its <details> is the first child details element.
  const engineerCard = page
    .locator('[role="button"]')
    .filter({ hasText: /Engineer/ })
    .first()
  await expect(engineerCard).toBeVisible({ timeout: 15_000 })

  // Click the <summary> inside the Engineer card to open the disclosure.
  const summary = engineerCard.locator('summary').first()
  await summary.click()

  // After opening, the Mechanical Knowledge L1 ability "Engineering Expertise"
  // (description: "Ask questions pertaining to mechanical and engineering topics.")
  // should be visible inline within the wizard — no navigation required.
  await expect(page.getByText('Engineering Expertise').first()).toBeVisible({ timeout: 15_000 })
})
