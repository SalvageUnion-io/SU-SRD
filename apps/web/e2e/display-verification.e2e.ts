import { advanceUntilVisible, buildPilot, openSheetFor, openWizard, pickByName } from './_helpers'
import { expect, test } from './fixtures'

// Signed in (the fixture's default): building needs an account, so a
// signed-out visitor never reaches a wizard pane.

/**
 * Display verification — confirms that the right *information* renders on
 * each surface, not just that the page loads. Catches regressions where a
 * card silently drops critical fields (stats, descriptions, traits). The
 * class step's trees are `pilot-wizard.e2e.ts`'s.
 */

test.describe('ability cards show their descriptions', () => {
  test('Engineering Expertise card includes its rules text', async ({ page }) => {
    await openWizard(page, 'pilots')
    // The first-Ability pool lives on the SAME step as the class, so the
    // ability's rules text is on screen as soon as a class is picked; a
    // clickNext here would advance past it to Equipment.
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
    await openWizard(page, 'mechs')

    // The mech wizard opens on the informational "Gain Scrap" step, so the
    // chassis list is one step in.
    await advanceUntilVisible(page, page.getByRole('heading', { name: /Craft your Mech Chassis/i }))

    // Mule should be present in the chassis row list.
    await expect(page.getByText(/^Mule$/).first()).toBeVisible()

    // Master-detail: selecting the Mule row renders its full card in the detail
    // pane, where ReferenceEntityCard surfaces the chassis stats as its header's
    // `[label | value]` cells (SP, SYS, MODS, …) — the short form at every size
    // since the one-anatomy card. Assert a stat label renders (proves
    // the stats block mounted).
    await pickByName(page, 'Mule')
    await expect(page.getByText(/^(SP|SYS|MODS)$/).first()).toBeVisible()
  })
})

test.describe('The Training Bay surfaces created entities with their identity', () => {
  test('newly built pilot shows up in the roster with their name', async ({ page }) => {
    // Drive the wizard through the shared builder rather than a fixed number
    // of Next clicks — that count was wrong the moment a step was inserted.
    // buildPilot lands back on the roster.
    await buildPilot(page, 'Display Test Pilot', 'DTP')

    // Name is displayed.
    await expect(page.getByText('Display Test Pilot').first()).toBeVisible({ timeout: 15_000 })
    // Each shelf item is one line that opens its live sheet (the Training
    // Bay), and the line is named by what it is — kind, class, name, HP — so a
    // screen-reader user can tell which unit each opens (WCAG 2.4.4).
    const line = page.getByRole('link', { name: /Display Test Pilot/ })
    await expect(line).toBeVisible({ timeout: 15_000 })
    await expect(line).toHaveAttribute('href', /\/sheet\/pilot\//)
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
