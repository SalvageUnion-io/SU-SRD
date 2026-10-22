import {
  addThroughPicker,
  advanceUntilVisible,
  choiceCardByName,
  clickNext,
  openApp,
  openSheetFor,
  openWizard,
  optionCells,
  pickByName,
  selectedOption,
  unselectedOptions,
  waitForReady,
} from './_helpers'
import { openTrainingBay, shelf } from './_trainingBay'
import { expect, test } from './fixtures'

/**
 * The pilot wizard (`/pilots/new`), one file per wizard: the build end to end
 * and its edit on the live sheet, the Class & Ability step, and the corner
 * cases. Each test opens the wizard with `openWizard` and reaches a step by its
 * content, never by counting Next clicks.
 */

/**
 * Pilot wizard happy path — create a pilot, then EDIT it (add a second ability
 * beyond the creation budget), reload, and verify persistence. Runs through a
 * real browser engine so it catches Chromium-level CSS/interaction issues the
 * happy-dom integration tests can't.
 *
 * CREATION BUDGETS ARE THE RULEBOOK'S, NOT THIS FILE'S. A pilot starts with
 * exactly **1** Ability (Core Book p.18) and **2** Tech 1 Equipment (p.19) —
 * `PILOT_CREATION_ABILITY_PICKS` / `PILOT_CREATION_EQUIPMENT_PICKS` in
 * `salvageunion-reference/lib/rules/creation.ts` are the source of truth. If
 * these numbers ever disagree with the constants, fix whichever is wrong by checking the book — do not simply relax
 * the test to whatever the app currently does.
 */
test('build a pilot from scratch, then edit to add a second ability', async ({ page }) => {
  await openWizard(page, 'pilots')

  // Step 1: Your Stats — derived starting values, nothing to choose.
  await clickNext(page)

  // Step 2: Class & Ability — the class, then exactly one Ability from the
  // trees that class reveals. Both halves gate Next.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')
  await clickNext(page)

  // Step 3: Equipment — exactly two Tech 1 picks.
  const equipmentOptions = unselectedOptions(page)
  await expect(equipmentOptions.first()).toBeVisible()
  await equipmentOptions.first().click()
  await equipmentOptions.first().click()
  await expect(page.getByTestId('equipment-count')).toHaveText('2 / 2')
  await clickNext(page)

  // Step 4: identity — name + callsign both required before Next opens.
  await page.getByLabel(/^Name/).fill('Mira Voss')
  await page.getByLabel(/Callsign/).fill('Sparks')

  // Steps 5-8 (Background / Motto / Keepsake / Appearance) are optional prose.
  // Walk to the Create CTA rather than counting them, so inserting or removing
  // an optional step does not break this spec — the mistake that put the whole
  // suite on the floor.
  const createPilot = page.getByRole('button', { name: /Create Pilot/i })
  await advanceUntilVisible(page, createPilot)

  // Review shows what we entered.
  await expect(page.getByText(/Mira Voss/).first()).toBeVisible()
  await expect(page.getByText(/Sparks/).first()).toBeVisible()
  await createPilot.click()

  // After submission we land on the roster.
  await page.waitForURL(/\/$/, { timeout: 15_000 })
  await waitForReady(page)
  await expect(page.getByText('Mira Voss').first()).toBeVisible({
    timeout: 15_000,
  })

  // --- Advancement, on the live sheet ---
  //
  // The live sheet is the Free Edit surface (ADR-021): you edit in place
  // rather than replaying Guided Creation. What matters is that an ability
  // beyond the creation budget can be added, and that it persists.
  await openSheetFor(page, 'Mira Voss')

  // The Abilities section's Manage Abilities opens the one shared picker.
  // 'Talk Shop' is Mechanical Knowledge level 2, so creation never offers it —
  // reaching it here is exactly the advancement-past-the-budget case.
  await addThroughPicker(page, /^Manage abilities$/i, 'Talk Shop')

  await expect(page.getByText('Talk Shop').first()).toBeVisible({
    timeout: 15_000,
  })

  // Reload — the edit persisted on the server (no duplicate pilot).
  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Talk Shop').first()).toBeVisible({
    timeout: 15_000,
  })
  await openApp(page, '/')
  // One sheet link on the roster, matched by href: this asserts a COUNT across
  // all rows, so it must not depend on any single entity's name.
  await expect(page.locator('a[href*="/sheet/"]')).toHaveCount(1)
})

/**
 * Regression guard: the Class step's Next CTA must open once — and only once —
 * the step is actually satisfied.
 *
 * The step is a master-detail: selectable class entity cards first, then the
 * chosen class's first-Ability pool. A render-time failure inside the detail
 * listing could leave the wizard stuck here with no way to advance.
 *
 * The gate is BOTH halves — "Step 2 of 9 · Choose your Pilot and your first
 * Ability". Asserting the two-part gate fails if EITHER half stops
 * registering.
 */
test('Next opens only once both class and first ability are picked', async ({ page }) => {
  await openWizard(page, 'pilots')
  // "Your Stats" precedes the Class step, so walk to the class cards first.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  const next = page.getByRole('button', { name: /^Next: / })
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
  await openWizard(page, 'pilots')
  // "Your Stats" precedes the Class step, so walk to the class cards first.
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

/**
 * Visual / interactive contract for the WizShell Class step master-detail:
 *  - Every base class renders as a selectable entity card (a `role="button"`
 *    cell carrying `aria-pressed`).
 *  - Selecting one marks exactly that card as the current selection.
 *  - The detail listing then renders the selected class's first-Ability pool
 *    with its tree labels — tree names and a known L1 ability are visible
 *    without any extra interaction.
 *
 * Selection is asserted through `selectedOption`, which matches the chosen cell
 * under EITHER selection semantic (`aria-pressed` toggle / `aria-checked`
 * radio). The previous version pinned `button[aria-current="true"]`, which was
 * `OptRow`'s attribute — a row this step had already stopped rendering, so the
 * assertion silently matched nothing.
 *
 * Guards against the recurring regression class: selection state drops out,
 * the detail pane fails to mount, ability listing fails to render.
 */
test('selecting a class marks it selected and reveals its trees', async ({ page }) => {
  await openWizard(page, 'pilots')
  // "Your Stats" precedes the Class step, so walk to the class cards first.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  // Pre-selection: nothing is chosen.
  await expect(selectedOption(page)).toHaveCount(0)

  await pickByName(page, 'Engineer')

  // Post-selection: exactly one chosen cell, and it is the Engineer card.
  await expect(selectedOption(page)).toHaveCount(1)
  await expect(selectedOption(page)).toContainText('Engineer')

  // The detail listing renders the Engineer ability pool with no disclosure to
  // open: each of its core trees, and its level-1 ability.
  for (const tree of [/Mechanical Knowledge/i, /Forging/i, /Mech-Tech/i]) {
    await expect(page.getByText(tree).first()).toBeVisible()
  }
  await expect(page.getByText('Engineering Expertise').first()).toBeVisible()
})

test('switching class moves the selection', async ({ page }) => {
  await openWizard(page, 'pilots')
  // "Your Stats" precedes the Class step, so walk to the class cards first.
  await advanceUntilVisible(page, choiceCardByName(page, 'Engineer'))

  await pickByName(page, 'Engineer')
  await expect(selectedOption(page)).toContainText('Engineer')

  await pickByName(page, 'Scout')
  await expect(selectedOption(page)).toHaveCount(1)
  await expect(selectedOption(page)).toContainText('Scout')

  // The detail listing now shows Scout's trees. Scout core trees: Recon,
  // Sleuth, Sniper — "Sleuth" is unambiguous.
  await expect(page.getByText(/Sleuth/i).first()).toBeVisible()
})

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
 * `PILOT_CREATION_EQUIPMENT_PICKS`. If they disagree with the app, check the
 * book before touching the app.
 */

test('cancel mid-wizard leaves the Training Bay with no new pilot', async ({ page }) => {
  await openTrainingBay(page)
  // Count pilots already in the Training Bay (0 for the fresh account, but count
  // rather than assume), by their sheet links: an item's link is named for
  // the pilot, so only its href says what it is.
  const sheets = shelf(page).locator('a[href*="/sheet/pilot/"]')
  const initialCount = await sheets.count()

  await openWizard(page, 'pilots')
  await pickByName(page, 'Engineer')
  // The form is now dirty (a class was picked), so `confirmCancel`
  // routes Cancel through a confirm dialog instead of navigating directly.
  // Confirm the discard, then the wizard abandons and navigates home.
  await page.getByRole('button', { name: /^Cancel$/ }).click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Discard$/ })
    .click()
  await page.waitForURL(/\/$/)
  await waitForReady(page)

  await expect(sheets).toHaveCount(initialCount)
})

test('switching class after picking an ability resets the ability list', async ({ page }) => {
  await openWizard(page, 'pilots')

  // Class and first Ability share one step, so switching class needs no trip
  // Back — the ability pool re-renders underneath the new class.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')

  // Switch to Scout: its trees do not include Engineering Expertise, so the
  // pick cannot carry over and the counter falls back to empty.
  await pickByName(page, 'Scout')
  await expect(page.getByTestId('ability-count')).toHaveText('0 / 1')
})

test('identity step gates Next until name + callsign are present', async ({ page }) => {
  await openWizard(page, 'pilots')

  // Satisfy the gated steps ahead of identity, then walk to it by content
  // rather than by counting Next clicks.
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await clickNext(page)
  const equipmentOptions = unselectedOptions(page)
  await expect(equipmentOptions.first()).toBeVisible()
  await equipmentOptions.first().click()
  await equipmentOptions.first().click()

  const nameField = page.getByLabel(/^Name/)
  await advanceUntilVisible(page, nameField)

  // Identity step — both fields required. Without them, Next is disabled.
  const next = page.getByRole('button', { name: /^Next: / })
  await expect(next).toBeDisabled()

  // Fill only the name, leave callsign blank.
  await nameField.fill('Only Name')
  await expect(next).toBeDisabled()

  // Add callsign — Next enables.
  await page.getByLabel(/Callsign/).fill('Cs')
  await expect(next).toBeEnabled()
})

test('a further ability pick is blocked once the budget is reached', async ({ page }) => {
  await openWizard(page, 'pilots')
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')

  // Other level-1 abilities stay on screen and stay clickable; the budget is
  // what holds. The old "Max Abilities selected (3 / 3)" footer notice no
  // longer exists anywhere in the app, so assert the invariant that matters —
  // the count cannot be pushed past the rulebook's single pick.
  for (const other of ['Jury Rig', 'Mass Field Maintenance']) {
    const card = choiceCardByName(page, other)
    if (!(await card.isVisible().catch(() => false))) continue
    await card.click().catch(() => {})
    await expect(page.getByTestId('ability-count')).toHaveText('1 / 1')
  }
})

test('a further equipment pick is blocked once the budget is reached', async ({ page }) => {
  await openWizard(page, 'pilots')
  await pickByName(page, 'Engineer')
  await pickByName(page, 'Engineering Expertise')
  await clickNext(page)

  // Equipment step — the budget is two Tech 1 picks (p.19).
  const unpicked = unselectedOptions(page)
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
