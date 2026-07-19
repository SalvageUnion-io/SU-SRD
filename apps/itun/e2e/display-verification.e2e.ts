import { test, expect } from '@playwright/test'
import { pickByName, waitForReady, clickNext } from './_helpers'

/**
 * Display verification — confirms that the right *information* renders on
 * each surface, not just that the page loads. Catches regressions where a
 * card silently drops critical fields (stats, descriptions, traits).
 */

test.describe('class step displays meaningful class info', () => {
  test('class card surfaces ability tree names', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)

    // Master-detail: selecting a class row renders its full card + ability
    // trees in the detail pane (no disclosure). Engineer's tree set is
    // "Mechanical Knowledge, Forging, Mech-Tech".
    await pickByName(page, 'Engineer')
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
    await expect(page.getByText(/Forging/i).first()).toBeVisible()
    await expect(page.getByText(/Mech-Tech/i).first()).toBeVisible()
  })

  test('selected class reveals trees + abilities listing', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')

    // The detail pane shows the trees + abilities directly (no disclosure).
    // Verify a tree name and a known L1 ability (Engineering Expertise).
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
    await expect(page.getByText(/Engineering Expertise/i).first()).toBeVisible()
  })
})

test.describe('ability cards show their descriptions', () => {
  test('Engineering Expertise card includes its rules text', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await clickNext(page)

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

    // Mule should be present in the chassis row list.
    await expect(page.getByText(/^Mule$/).first()).toBeVisible()

    // Master-detail: selecting the Mule row renders its full card in the detail
    // pane, where ReferenceEntityCard surfaces the chassis stat blocks
    // (Structure Points, System Slots, Heat Capacity, …) as labelled values.
    // Assert a stat label renders (proves the stats block mounted).
    await pickByName(page, 'Mule')
    await expect(page.getByText(/SLOTS|CAPACITY|POINTS/i).first()).toBeVisible()
  })
})

test.describe('dashboard surfaces created entities with their identity', () => {
  test('newly built pilot shows up in the dashboard list with their name', async ({ page }) => {
    await page.goto('/pilots/new')
    await waitForReady(page)
    await pickByName(page, 'Engineer')
    await clickNext(page)
    await clickNext(page)
    await clickNext(page)
    await page.getByLabel(/^Name/).fill('Display Test Pilot')
    await page.getByLabel(/Callsign/).fill('DTP')
    await clickNext(page)
    await clickNext(page)
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
    await clickNext(page)
    await pickByName(page, 'Engineering Expertise')
    await clickNext(page)
    await page.locator('div[role="button"]').first().click()
    await clickNext(page)
    await page.getByLabel(/^Name/).fill('Sheet Name')
    await page.getByLabel(/Callsign/).fill('SN')
    await clickNext(page)
    await clickNext(page)
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
    // and rendered via ReferenceEntityCard on the pilot sheet.
    await expect(page.getByText(/Engineering Expertise/).first()).toBeVisible()
    // The selected ability should also be labelled with its tree name.
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
  })
})
