import { test, expect } from '@playwright/test'
import {
  advanceUntilVisible,
  fillIdentity,
  installLoadoutItem,
  pickByName,
  waitForReady,
} from './_helpers'

/**
 * Mech-only build — steps through the Mech Workshop wizard and submits, then
 * edits the created mech's loadout on its live sheet.
 *
 * The wizard is Gain Scrap → Craft your Mech Chassis → Statistics → Craft your
 * Systems → Craft your Modules → Quirk → Appearance → Name → Review. It used to
 * be described here as Chassis → Pattern → Loadout → Identity → Review, and
 * this spec picked a "Custom Pattern" card that no longer exists — chassis are
 * chosen directly and the loadout is crafted across the Systems/Modules steps.
 *
 * Only the chassis step gates, so walk to the steps this test cares about by
 * their content instead of counting Next clicks.
 */
test('build a mech from scratch', async ({ page }) => {
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)

  // Chassis — Mule is a guaranteed SU starter chassis. pickByName walks past
  // the ungated Gain Scrap step to reach it.
  await pickByName(page, 'Mule')

  // Systems — install one, so the created mech carries a real loadout.
  const addCargoPod = page.getByRole('button', { name: /^Add (one )?Cargo Pod$/i })
  await advanceUntilVisible(page, addCargoPod)
  await installLoadoutItem(page, 'Cargo Pod')

  // Name — a mech's name IS its pattern, behind a click-to-edit field.
  const nameEditor = page.getByLabel(/^Edit name \/ pattern$/i)
  await advanceUntilVisible(page, nameEditor)
  await fillIdentity(page, 'name / pattern', 'Iron Fist')

  const createMech = page.getByRole('button', { name: /Create Mech/i })
  await advanceUntilVisible(page, createMech)
  await createMech.click()

  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
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
  // Build first.
  await page.goto('/mechs/new?mode=guided')
  await waitForReady(page)
  await pickByName(page, 'Mule')

  const nameEditor = page.getByLabel(/^Edit name \/ pattern$/i)
  await advanceUntilVisible(page, nameEditor)
  await fillIdentity(page, 'name / pattern', 'Iron Fist')

  const createMech = page.getByRole('button', { name: /Create Mech/i })
  await advanceUntilVisible(page, createMech)
  await createMech.click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 })
  await waitForReady(page)

  // Open the mech's live sheet from its roster row.
  await page
    .locator('li', { hasText: 'Iron Fist' })
    .getByRole('link', { name: /^View$/ })
    .click()
  await page.waitForURL(/\/sheet\/mech\//, { timeout: 15_000 })
  await waitForReady(page)

  // '+ Add system' opens the shared picker, which writes through on toggle.
  await page.getByRole('button', { name: /^Add system$/i }).click()
  const picker = page.getByRole('dialog')
  await expect(picker).toBeVisible()
  // The systems picker runs the searcher in `mode="count"` (installing the
  // same System twice is rules-legal), so each row carries an "Add one <name>"
  // button rather than being a click-to-toggle card. Clicking the card's prose
  // does nothing at all.
  await picker.getByRole('button', { name: /^Add (one )?Cargo Pod$/i }).click()
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()

  await expect(page.getByText('Cargo Pod').first()).toBeVisible({ timeout: 15_000 })

  // Reload — the edit persisted to IndexedDB against the same record.
  await page.reload()
  await waitForReady(page)
  await expect(page.getByText('Cargo Pod').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Iron Fist').first()).toBeVisible()
})
