import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Regression guard: selecting a class on Step 1 must enable the Next CTA.
 *
 * The WizShell class step is a master-detail: OptRow buttons on the left,
 * the selected class's full card + ability trees in the detail pane. A
 * render-time failure inside the detail listing could leave the wizard
 * stuck on the Class step with no way to advance.
 */
test('Next is disabled before class pick and enabled after', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  const next = page.getByRole('button', { name: /^Next ·/ })
  await expect(next).toBeDisabled()

  await pickByName(page, 'Engineer')
  await expect(next).toBeEnabled()

  // And clicking Next actually advances to the Abilities step.
  await next.click()
  await expect(page.getByRole('heading', { name: /Choose Abilities/i })).toBeVisible()
})

test('every base class renders a selectable row', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Master-detail: each base class is an OptRow <button>; the active row
  // carries aria-current. SU core book has 6 base classes; allow more from
  // additional sources. Stepper + footer buttons exist too, so count rows
  // via the option pane's OptRow look: buttons containing the 'art' slot.
  const rows = page.getByRole('button').filter({ hasText: 'art' })
  await expect(rows.first()).toBeVisible({ timeout: 15_000 })
  expect(await rows.count()).toBeGreaterThanOrEqual(6)
})

test('selecting Engineer reveals its abilities in the detail pane', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Selecting the Engineer row renders its trees + abilities in the detail
  // pane directly (no disclosure). The Mechanical Knowledge L1 ability
  // "Engineering Expertise" should be visible without navigating.
  await pickByName(page, 'Engineer')
  await expect(page.getByText('Engineering Expertise').first()).toBeVisible({
    timeout: 15_000,
  })
})
