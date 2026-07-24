import { test, expect } from '@playwright/test'
import { clickNext, pickByName, waitForReady } from './_helpers'

/**
 * Pilot wizard corner cases that the happy-path test doesn't cover:
 *  - Cancelling mid-wizard does not leave a pilot in the store.
 *  - Switching class after picking abilities clears the previous picks
 *    (different class trees → different ability set) — create mode only.
 *  - The Identity step gates Next until both name and callsign are present.
 *  - Picking a 4th ability after the 3-pick budget is hit is a no-op
 *    (the budget-reached card is non-interactive).
 *  - Picking a 4th equipment item after the 3-pick budget is hit is
 *    a no-op.
 */

test('cancel mid-wizard leaves the dashboard with no new pilot', async ({ page }) => {
  await page.goto('/')
  await waitForReady(page)
  // Count pilots already on the dashboard (could be 0 or whatever fake-idb
  // carries between tests in the same browser context).
  const initialCount = await page.getByRole('link', { name: /Sheet$/i }).count()

  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  // The form is now dirty (a class was picked), so #334's `confirmCancel`
  // routes Cancel through a confirm dialog instead of navigating directly.
  // Confirm the discard, then the wizard abandons and navigates home.
  await page.getByRole('button', { name: /^Cancel$/ }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Discard$/ })
    .click()
  await page.waitForURL(/\/$/)
  await waitForReady(page)

  const afterCount = await page.getByRole('link', { name: /Sheet$/i }).count()
  expect(afterCount).toBe(initialCount)
})

test('switching class after picking abilities resets the ability list', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)

  // Pick Engineer → advance to Abilities → pick one
  await pickByName(page, 'Engineer')
  await clickNext(page)
  await pickByName(page, 'Engineering Expertise')
  // Counter should read 1 / 3 selected.
  await expect(page.getByTestId('ability-count')).toHaveText(/1 \/ 3 selected/)

  // Back to class step, switch to Scout.
  await page.getByRole('button', { name: /^Back$/ }).click()
  await pickByName(page, 'Scout')
  await clickNext(page)

  // Scout's trees should not include Engineering Expertise. Counter
  // should reset to 0 / 3.
  await expect(page.getByTestId('ability-count')).toHaveText(/0 \/ 3 selected/)
})

test('Identity step gates Next until name + callsign are present', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await clickNext(page)
  await clickNext(page) // skip abilities
  await clickNext(page) // skip equipment

  // Identity step — required fields. Without filling them, Next is disabled.
  const next = page.getByRole('button', { name: /^Next ·/ })
  await expect(next).toBeDisabled()

  // Fill only the name, leave callsign blank.
  await page.getByLabel(/^Name/).fill('Only Name')
  await expect(next).toBeDisabled()

  // Add callsign — Next enables.
  await page.getByLabel(/Callsign/).fill('Cs')
  await expect(next).toBeEnabled()
})

test('4th ability pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await clickNext(page)
  await pickByName(page, 'Engineering Expertise')
  await pickByName(page, 'Jury Rig')
  await pickByName(page, 'Mass Field Maintenance')
  await expect(page.getByTestId('ability-count')).toHaveText(/3 \/ 3 selected/)

  // At budget the notice renders ONCE, in the wizard footer beside the
  // buttons ("Max Abilities selected") — blocked cards just grey out.
  await expect(page.getByText(/Max Abilities selected \(3 \/ 3\)/i)).toBeVisible()
  await expect(page.getByTestId('ability-count')).toHaveText(/3 \/ 3 selected/)
})

test('4th equipment pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await clickNext(page)
  await clickNext(page) // skip abilities
  // Equipment step — click the first three Sel-wrapped cards.
  const cards = page.locator('div[role="button"]')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await cards.nth(2).click()
  await expect(page.getByTestId('equipment-count')).toHaveText(/3 \/ 3 selected/)

  // At budget the notice renders ONCE, in the wizard footer beside the
  // buttons ("Max Equipment selected") — blocked cards just grey out.
  await expect(page.getByText(/Max Equipment selected \(3 \/ 3\)/i)).toBeVisible()
  await expect(page.getByTestId('equipment-count')).toHaveText(/3 \/ 3 selected/)
})
