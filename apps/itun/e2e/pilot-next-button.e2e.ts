import { expect, test } from '@playwright/test'
import {
  advanceUntilVisible,
  choiceCardByName,
  optionCells,
  pickByName,
  waitForReady,
} from './_helpers'

/**
 * Regression guard: the Class step's Next CTA must open once — and only once —
 * the step is actually satisfied.
 *
 * The step is a master-detail: selectable class entity cards first, then the
 * chosen class's first-Ability pool. A render-time failure inside the detail
 * listing could leave the wizard stuck here with no way to advance.
 *
 * The gate is BOTH halves — "Step 2 of 9 · Choose your Pilot and your first
 * Ability". This test used to assert that picking a class alone enabled Next,
 * which stopped being true when the step absorbed the first-Ability pick;
 * asserting the real two-part gate is the stronger guard anyway, because it
 * fails if EITHER half stops registering.
 */
test('Next opens only once both class and first ability are picked', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  // "Your Stats" now precedes the Class step, so the Class step is no longer
  // the landing step these assertions were written against.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  const next = page.getByRole('button', { name: /^Next ·/ })
  await expect(next).toBeDisabled()

  // Half one: the class. Not enough on its own.
  await pickByName(page, 'Engineer')
  await expect(next, 'a class alone must not satisfy the class+ability step').toBeDisabled()

  // Half two: a first Ability from the pool the class just revealed
  // (Engineer / Mechanical Knowledge L1).
  await pickByName(page, 'Engineering Expertise')
  await expect(next).toBeEnabled()

  // And clicking Next actually advances to Equipment (step 3 of 9).
  await next.click()
  await expect(page.getByRole('heading', { name: /Choose your Equipment/i })).toBeVisible()
})

test('every base class renders a selectable row', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  // "Your Stats" now precedes the Class step, so the Class step is no longer
  // the landing step these assertions were written against.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  // Each base class is a selectable entity card. SU core book has 6 base
  // classes; allow more from additional sources. The stepper, footer and CTA
  // buttons are NOT selection cells, so counting cells that carry a selection
  // state (`aria-pressed` / `aria-checked`) counts exactly the class options —
  // and before a class is picked the ability pool has not rendered, so nothing
  // else contributes. The previous version counted buttons containing the
  // literal text 'art', which was `OptRow`'s placeholder art box: that row is
  // gone, and the count would have matched zero.
  const rows = optionCells(page)
  await expect(rows.first()).toBeVisible({ timeout: 15_000 })
  expect(await rows.count()).toBeGreaterThanOrEqual(6)
})

test('selecting Engineer reveals its abilities in the detail pane', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  // "Your Stats" now precedes the Class step, so the Class step is no longer
  // the landing step these assertions were written against.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  // Selecting the Engineer row renders its trees + abilities in the detail
  // pane directly (no disclosure). The Mechanical Knowledge L1 ability
  // "Engineering Expertise" should be visible without navigating.
  await pickByName(page, 'Engineer')
  await expect(page.getByText('Engineering Expertise').first()).toBeVisible({
    timeout: 15_000,
  })
})
