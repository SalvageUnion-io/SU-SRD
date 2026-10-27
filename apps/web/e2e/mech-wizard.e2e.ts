import { at } from './_base'
import {
  addThroughPicker,
  advanceUntilVisible,
  buildMech,
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
 * its edit on the live sheet; its gates are unit-tested in MechWizard.test.tsx.
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
