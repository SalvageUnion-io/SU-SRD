import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Display verification — confirms that the right *information* renders on
 * each surface, not just that the page loads. Catches regressions where a
 * card silently drops critical fields (stats, descriptions, traits).
 */

test.describe('class step displays meaningful class info', () => {
  test('class card surfaces ability tree names', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)

    // Engineer's tree set is "Mechanical Knowledge, Forging, Mech-Tech".
    // After the restyle, tree names live inside a collapsible <details>
    // disclosure on each class card ("Show abilities"). Expand the Engineer
    // card's disclosure first, then assert the tree names are visible.
    const engineerCard = page.locator('div[role="button"]').filter({ hasText: 'Engineer' }).first()
    await expect(engineerCard).toBeVisible()
    const disclosure = engineerCard.locator('details').first()
    await disclosure.locator('summary').click()
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
    await expect(page.getByText(/Forging/i).first()).toBeVisible()
    await expect(page.getByText(/Mech-Tech/i).first()).toBeVisible()
  })

  test('selected class reveals trees + abilities listing', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')

    // After the restyle the "Engineer — Trees & Abilities" heading was removed.
    // Trees and abilities now live inside a "Show abilities" <details>
    // disclosure on the selected class card. Expand it, then verify the tree
    // names and a known L1 ability (Engineering Expertise) are present.
    const engineerCard = page.locator('div[role="button"]').filter({ hasText: 'Engineer' }).first()
    await engineerCard.locator('details summary').click()
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
    await expect(page.getByText(/Engineering Expertise/i).first()).toBeVisible()
  })
})

test.describe('ability cards show their descriptions', () => {
  test('Engineering Expertise card includes its rules text', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await page.getByRole('button', { name: /^Next$/ }).click()

    // The description (per SU SRD) mentions "questions" about
    // mechanical/engineering topics. Match a phrase fragment to stay
    // robust to minor copy edits.
    await expect(
      page.getByText(/questions.*mechanical|mechanical.*engineering/i).first()
    ).toBeVisible()
  })
})

test.describe('chassis cards show stats from the SRD', () => {
  test('Mule chassis card renders its name and at least one stat', async ({ page }) => {
    await page.goto('/mechs/new')
    await waitForReady(page)

    // Mule should be present in the chassis grid.
    await expect(page.getByText(/^Mule$/).first()).toBeVisible()

    // ReferenceEntityDisplay renders entity stats in the card header — at
    // least one numeric stat (SP, HP, Slots) should show up.
    // We can't pin to an exact value (data may evolve) but at minimum a
    // digit followed by "/" or "SP"/"HP" should be present somewhere on
    // the page.
    const hasStat = await page
      .getByText(/\b\d+\s*(SP|HP|Slots|\/)/i)
      .first()
      .isVisible()
    expect(hasStat).toBe(true)
  })
})

test.describe('dashboard surfaces created entities with their identity', () => {
  test('newly built pilot shows up in the dashboard list with their name', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByLabel(/^Name/).fill('Display Test Pilot')
    await page.getByLabel(/Callsign/).fill('DTP')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /Create Pilot/i }).click()

    // onComplete navigates to '/'; wait for that navigation then assert
    // immediately — the Zustand in-memory store already holds the created
    // pilot, so no extra page.goto('/') reload is needed (and adding one
    // can race with the IndexedDB re-hydration that happens on mount).
    await page.waitForURL(/\/(pilots\/|$)/, { timeout: 15_000 })

    // Name is displayed.
    await expect(page.getByText('Display Test Pilot').first()).toBeVisible({ timeout: 15_000 })
    // EntityListItem renders a "View" and "Sheet" link for each entity.
    await expect(page.getByRole('link', { name: /^View$/ }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^Sheet$/ }).first()).toBeVisible()
  })
})

test.describe('sheet renders the right pilot identity', () => {
  test('opening a pilot sheet shows their name and class context', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await pickByName(page, 'Engineering Expertise')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.locator('div[role="button"]').first().click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByLabel(/^Name/).fill('Sheet Name')
    await page.getByLabel(/Callsign/).fill('SN')
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.getByRole('button', { name: /Create Pilot/i }).click()

    // onComplete navigates to '/'; wait then interact from there — no extra
    // page.goto('/') needed (avoids IndexedDB re-hydration race on reload).
    await page.waitForURL(/\/(pilots\/|$)/, { timeout: 15_000 })
    await expect(page.getByText('Sheet Name').first()).toBeVisible({ timeout: 15_000 })
    await page
      .getByRole('link', { name: /^Sheet$/ })
      .first()
      .click()
    await page.waitForURL(/\/sheet\//)
    await waitForReady(page)

    await expect(page.getByText('Sheet Name').first()).toBeVisible()
    // "Engineering Expertise" contains "Engineer" — the ability is resolved
    // and rendered via ReferenceEntityDisplay on the pilot sheet.
    await expect(page.getByText(/Engineering Expertise/).first()).toBeVisible()
    // The selected ability should also be labelled with its tree name.
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
  })
})
