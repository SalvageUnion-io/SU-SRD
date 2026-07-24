import { test, expect } from '@playwright/test'
import { advanceUntilVisible, clickNext, pickByName, waitForReady } from './_helpers'

/**
 * Pilot wizard corner cases that the happy-path test doesn't cover:
 *  - Cancelling mid-wizard does not leave a pilot in the store.
 *  - Switching class after picking an ability clears the previous pick
 *    (different class trees → different ability set) — create mode only.
 *  - The identity step gates Next until both name and callsign are present.
 *  - Picking past the ability budget is a no-op.
 *  - Picking past the equipment budget is a no-op.
 *
 * The budgets are the rulebook's: exactly 1 Ability (Core Book p.18) and 2
 * Tech 1 Equipment (p.19) — `PILOT_CREATION_ABILITY_PICKS` /
 * `PILOT_CREATION_EQUIPMENT_PICKS`. These cases previously asserted a 3-pick
 * budget and a `3 / 3 selected` counter, neither of which matched the rules or
 * the UI; if they disagree again, check the book before touching the app.
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

test('switching class after picking an ability resets the ability list', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)

  // Class and first Ability now share one step, so switching class no longer
  // needs a trip Back — the ability pool re-renders underneath the new class.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')

  // Switch to Scout: its trees do not include Engineering Expertise, so the
  // pick cannot carry over and the counter falls back to empty.
  await pickByName(page, 'Scout')
  await expect(page.getByTestId('ability-count')).toHaveText('0 / 1')
})

test('identity step gates Next until name + callsign are present', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)

  // Satisfy the gated steps ahead of identity, then walk to it by content
  // rather than by counting Next clicks.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await clickNext(page)
  const equipmentOptions = page.locator('[aria-pressed="false"], [aria-checked="false"]')
  await expect(equipmentOptions.first()).toBeVisible()
  await equipmentOptions.first().click()
  await equipmentOptions.first().click()

  const nameField = page.getByLabel(/^Name/)
  await advanceUntilVisible(page, nameField)

  // Identity step — both fields required. Without them, Next is disabled.
  const next = page.getByRole('button', { name: /^Next ·/ })
  await expect(next).toBeDisabled()

  // Fill only the name, leave callsign blank.
  await nameField.fill('Only Name')
  await expect(next).toBeDisabled()

  // Add callsign — Next enables.
  await page.getByLabel(/Callsign/).fill('Cs')
  await expect(next).toBeEnabled()
})

test('a further ability pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')

  // Other level-1 abilities stay on screen and stay clickable; the budget is
  // what holds. The old "Max Abilities selected (3 / 3)" footer notice no
  // longer exists anywhere in the app, so assert the invariant that matters —
  // the count cannot be pushed past the rulebook's single pick.
  for (const other of ['Jury Rig', 'Mass Field Maintenance']) {
    const card = page
      .getByRole('button')
      .or(page.getByRole('radio'))
      .filter({ hasText: other })
      .first()
    if (!(await card.isVisible().catch(() => false))) continue
    await card.click().catch(() => {})
    await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')
  }
})

test('a further equipment pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await clickNext(page)

  // Equipment step — the budget is two Tech 1 picks (p.19).
  const unpicked = page.locator('[aria-pressed="false"], [aria-checked="false"]')
  await expect(unpicked.first()).toBeVisible()
  await unpicked.first().click()
  await unpicked.first().click()
  await expect(page.getByTestId('equipment-count')).toHaveText('2 / 2')

  // A third pick cannot exceed the budget. As with abilities, the footer
  // notice is gone; the count holding at the budget is the real contract.
  await unpicked
    .first()
    .click()
    .catch(() => {})
  await expect(page.getByTestId('equipment-count')).toHaveText('2 / 2')
})
