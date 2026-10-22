import { at } from './_base'
import {
  addThroughPicker,
  advanceUntilVisible,
  buildMech,
  clickNext,
  fillIdentity,
  installLoadoutItem,
  openSheetFor,
  openWizard,
  pickByName,
  waitForReady,
} from './_helpers'
import { expect, test } from './fixtures'

/**
 * The mech wizard (`/mechs/new`), one file per wizard: the build end to end and
 * its edit on the live sheet, then the corner cases.
 */

/**
 * Mech-only build — steps through the Mech Workshop wizard and submits, then
 * edits the created mech's loadout on its live sheet.
 *
 * The wizard is Gain Scrap → Craft your Mech Chassis → Statistics → Craft your
 * Systems → Craft your Modules → Quirk → Appearance → Name → Review: chassis are
 * chosen directly and the loadout is crafted across the Systems/Modules steps.
 *
 * Only the chassis step gates, so walk to the steps this test cares about by
 * their content instead of counting Next clicks.
 */
test('build a mech from scratch', async ({ page }) => {
  await openWizard(page, 'mechs')

  // Chassis — Mule is a guaranteed SU starter chassis. pickByName walks past
  // the ungated Gain Scrap step to reach it.
  await pickByName(page, 'Mule')

  // Systems — install one, so the created mech carries a real loadout.
  const addCargoPod = page.getByRole('button', { name: /^Increase Cargo Pod count$/i })
  await advanceUntilVisible(page, addCargoPod)
  await installLoadoutItem(page, 'Cargo Pod')

  // Name — a mech's name IS its pattern, behind a click-to-edit field.
  const nameEditor = page.getByLabel(/^Edit name \/ pattern$/i)
  await advanceUntilVisible(page, nameEditor)
  await fillIdentity(page, 'name / pattern', 'Iron Fist')

  const createMech = page.getByRole('button', { name: /Create Mech/i })
  await advanceUntilVisible(page, createMech)
  await createMech.click()

  await page.waitForURL((url) => url.pathname === at('/'), { timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible({
    timeout: 15_000,
  })
})

/**
 * Mech edit round-trip. The old /mechs/$id/edit route is gone — /mechs/$id is
 * now a bare redirect and the per-entity detail page was collapsed into the
 * live sheet, which under ADR-021 is the Free Edit surface. The intent is
 * unchanged: change the loadout after creation and have it persist.
 */
test('edit a mech loadout on its live sheet', async ({ page }) => {
  // Build it (the shared builder takes the Mule), then open its live sheet.
  await buildMech(page, 'Iron Fist')
  await openSheetFor(page, 'Iron Fist')

  // Manage Systems opens the systems picker: the searcher in `mode="count"`
  // (installing the same System twice is rules-legal).
  await addThroughPicker(page, /^Manage systems$/i, 'Cargo Pod')

  await expect(page.getByText('Cargo Pod').first()).toBeVisible({ timeout: 15_000 })

  // Reload — the edit persisted on the server against the same record.
  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Cargo Pod').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible()
})

/**
 * MechWizard corner cases (Mech Workshop wizard):
 *  - The stepper gates progress: the Chassis step needs a chassis, and the Name
 *    step needs a name, before Create is enabled on Review.
 *  - The craft steps show their budget trackers — Scrap plus the slot budget
 *    for whichever of Systems / Modules is being crafted.
 *
 * A chassis is picked directly (there is no "Custom Pattern" card), and the
 * craft steps report their budgets in the WizTracker pill asserted below. The
 * first step is not gated: "Gain Scrap" is informational, so Next is open from
 * the start.
 */

test('wizard gates progress until chassis + name are set', async ({ page }) => {
  await openWizard(page, 'mechs')

  const next = page.getByRole('button', { name: /^Next: / })

  // Step 1 (Gain Scrap) is informational — nothing to satisfy.
  await expect(next).toBeEnabled()
  await clickNext(page)

  // Chassis step — Next is gated until a chassis is chosen.
  await expect(next).toBeDisabled()
  await pickByName(page, 'Mule')
  await expect(next).toBeEnabled()

  // Name step — gated until the mech is named (its name IS its pattern).
  const nameEditor = page.getByLabel(/^Edit name \/ pattern$/i)
  await advanceUntilVisible(page, nameEditor)
  await expect(next).toBeDisabled()
  await fillIdentity(page, 'name / pattern', 'Iron Fist')
  await expect(next).toBeEnabled()

  // Review — Create is enabled.
  await clickNext(page)
  await expect(page.getByRole('button', { name: /Create Mech/i })).toBeEnabled()
})

test('the craft steps show their scrap and slot budget trackers', async ({ page }) => {
  await openWizard(page, 'mechs')

  await pickByName(page, 'Mule')

  // Systems craft step — Scrap plus the System Slots budget.
  const systemSlots = page.getByTestId('system-slot-count')
  await advanceUntilVisible(page, systemSlots)
  await expect(page.getByTestId('scrap-remaining')).toBeVisible()
  await expect(systemSlots).toHaveText(/\d+ \/ \d+/)

  // Modules craft step — Scrap plus its own Module Slots budget. These are
  // separate steps now, not two tabs of one Loadout step.
  const moduleSlots = page.getByTestId('module-slot-count')
  await advanceUntilVisible(page, moduleSlots)
  await expect(page.getByTestId('scrap-remaining')).toBeVisible()
  await expect(moduleSlots).toHaveText(/\d+ \/ \d+/)
})
