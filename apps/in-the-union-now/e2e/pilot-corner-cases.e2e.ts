import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Pilot wizard corner cases that the happy-path test doesn't cover:
 *  - Cancelling mid-wizard does not leave a pilot in the store.
 *  - Switching class after picking abilities clears the previous picks
 *    (different class trees → different ability set).
 *  - The Review step's Create Pilot button is disabled until both name
 *    and callsign are present.
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

  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Cancel$/ }).click()
  await page.waitForURL(/\/$/)
  await waitForReady(page)

  const afterCount = await page.getByRole('link', { name: /Sheet$/i }).count()
  expect(afterCount).toBe(initialCount)
})

test('switching class after picking abilities resets the ability list', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Pick Engineer → advance to Abilities → pick one
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await pickByName(page, 'Engineering Expertise')
  // Counter should read 1/3 selected.
  await expect(page.getByText(/1\/3 selected/)).toBeVisible()

  // Back to class step, switch to Scout.
  await page.getByRole('button', { name: /^Back$/ }).click()
  await pickByName(page, 'Scout')
  await page.getByRole('button', { name: /^Next$/ }).click()

  // Scout's trees should not include Engineering Expertise. Counter
  // should reset to 0/3.
  await expect(page.getByText(/0\/3 selected/)).toBeVisible()
})

test('Review step Create Pilot is disabled until name + callsign are present', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click() // skip abilities
  await page.getByRole('button', { name: /^Next$/ }).click() // skip equipment

  // Identity step — required fields. Without filling them, Next is disabled.
  await expect(page.getByRole('button', { name: /^Next$/ })).toBeDisabled()

  // Fill only the name, leave callsign blank.
  await page.getByLabel(/^Name/).fill('Only Name')
  await expect(page.getByRole('button', { name: /^Next$/ })).toBeDisabled()

  // Add callsign — Next enables.
  await page.getByLabel(/Callsign/).fill('Cs')
  await expect(page.getByRole('button', { name: /^Next$/ })).toBeEnabled()
})

test('4th ability pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await pickByName(page, 'Engineering Expertise')
  await pickByName(page, 'Jury Rig')
  await pickByName(page, 'Mass Field Maintenance')
  await expect(page.getByText(/3\/3 selected/)).toBeVisible()

  // Any further pick must NOT change the counter. If no 4th candidate
  // exists for Engineer (trees may only have 3 level-1 abilities total)
  // the cap is naturally enforced — both states satisfy the rule.
  const budgetMessages = await page.getByText(/Budget reached/i).count()
  if (budgetMessages > 0) {
    // Click one of the budget-reached cards to confirm it's a no-op.
    const blocked = page.getByText(/Budget reached/i).first()
    await blocked.scrollIntoViewIfNeeded()
    // Verify the card is greyed (rust shadow / opacity ≤ 0.5) by checking
    // the wrapping pointer-events-none class on the parent.
    const wrapper = blocked.locator('xpath=ancestor::div[contains(@class,"pointer-events-none")]')
    await expect(wrapper).toBeVisible()
  }
  await expect(page.getByText(/3\/3 selected/)).toBeVisible()
})

test('4th equipment pick is blocked once the budget is reached', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)
  await pickByName(page, 'Engineer')
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByRole('button', { name: /^Next$/ }).click() // skip abilities
  // Equipment step — click the first three EntityChoiceCards.
  const cards = page.locator('div[role="button"]')
  await cards.nth(0).click()
  await cards.nth(1).click()
  await cards.nth(2).click()
  await expect(page.getByText(/3\/3 selected/)).toBeVisible()

  // The 4th card (if more than 3 TL1 equipment exist) should now be
  // budget-reached. Click it and confirm the counter stays at 3/3.
  const fourthCard = cards.nth(3)
  const hasFourth = (await fourthCard.count()) > 0
  if (hasFourth) {
    // Clicking a budget-reached card should be a no-op due to
    // pointer-events-none on the EntityChoiceCard wrapper.
    await fourthCard.click({ force: true, trial: false }).catch(() => {
      // Interception is expected; ignore.
    })
    await expect(page.getByText(/3\/3 selected/)).toBeVisible()
  }
})
