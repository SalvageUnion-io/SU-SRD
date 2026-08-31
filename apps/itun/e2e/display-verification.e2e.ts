import { expect, test } from '@playwright/test'
import { advanceUntilVisible, buildPilot, openSheetFor, pickByName, waitForReady } from './_helpers'

/**
 * Display verification — confirms that the right *information* renders on
 * each surface, not just that the page loads. Catches regressions where a
 * card silently drops critical fields (stats, descriptions, traits).
 */

test.describe('class step displays meaningful class info', () => {
  test('class card surfaces ability tree names', async ({ page }) => {
    await page.goto('/pilots/new?mode=guided')
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
    await page.goto('/pilots/new?mode=guided')
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
    await page.goto('/pilots/new?mode=guided')
    await waitForReady(page)
    // The first-Ability pool now lives on the SAME step as the class, so the
    // ability's rules text is on screen as soon as a class is picked — the
    // clickNext that used to be here advanced past it to Equipment.
    await pickByName(page, 'Engineer')

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
    await page.goto('/mechs/new?mode=guided')
    await waitForReady(page)

    // The mech wizard opens on the informational "Gain Scrap" step, so the
    // chassis list is one step in.
    await advanceUntilVisible(page, page.getByRole('heading', { name: /Craft your Mech Chassis/i }))

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
  test('newly built pilot shows up in the roster with their name', async ({ page }) => {
    // Drive the wizard through the shared builder rather than a fixed number
    // of Next clicks — that count was wrong the moment a step was inserted.
    // buildPilot lands back on the roster.
    await buildPilot(page, 'Display Test Pilot', 'DTP')

    // Name is displayed.
    await expect(page.getByText('Display Test Pilot').first()).toBeVisible({ timeout: 15_000 })
    // EntityRow renders one link per entity, to its live sheet.
    //
    // Matched on the FULL accessible name, not the visible text. The visible
    // label is "View" on every row, so the link carries
    // `aria-label="View <name>"` — without it a screen-reader user hears
    // "View, View, View" with no way to tell which unit each opens (WCAG 2.4.4).
    //
    // `/^View$/` therefore stopped matching the moment that aria-label landed,
    // and this spec had been red every night since. Asserting the composed name
    // fixes the break AND pins the accessibility fix, which a match on `href`
    // alone would silently let regress.
    await expect(page.getByRole('link', { name: 'View Display Test Pilot' })).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe('sheet renders the right pilot identity', () => {
  test('opening a pilot sheet shows their name and class context', async ({ page }) => {
    // buildPilot deterministically picks Engineer, which is what the ability
    // assertions below depend on.
    await buildPilot(page, 'Sheet Name', 'SN')
    await expect(page.getByText('Sheet Name').first()).toBeVisible({ timeout: 15_000 })

    await openSheetFor(page, 'Sheet Name')

    await expect(page.getByText('Sheet Name').first()).toBeVisible()
    // "Engineering Expertise" contains "Engineer" — the ability is resolved
    // and rendered via ReferenceEntityCard on the pilot sheet.
    await expect(page.getByText(/Engineering Expertise/).first()).toBeVisible()
    // The selected ability should also be labelled with its tree name.
    await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
  })
})
