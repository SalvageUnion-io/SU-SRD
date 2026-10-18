import { buildPilot, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Shelves delete flow: create a pilot, confirm the delete dialog, verify
 * the pilot disappears. Catches regressions in the Roster's delete confirm
 * (src/components `ConfirmDialog`) and the shelf item's ⋯ menu Delete wiring.
 *
 * The shared builder (`buildPilot`) walks whatever steps the pilot wizard has
 * and returns once the redirect back to Shelves ("/") has landed.
 *
 * Shelf hydration is async (the account's rows arrive from Convex). We
 * wait for the pilot's name to become visible in the entity list rather than
 * relying solely on waitForReady (which only signals game-data preload).
 *
 * Delete lives in each shelf item's ⋯ menu (Shelves, board S1): the trigger is
 * named "More for <name>", and the row is the menuitem "Delete…". The confirm
 * is an alert dialog (role="alertdialog") with a "Delete" confirm button.
 */

test('create then delete a pilot from Shelves', async ({ page }) => {
  // ── Step 1: Build a minimal pilot ──────────────────────────────────────────
  // The shared builder walks whatever steps the wizard currently has and
  // returns once the redirect to "/" has landed.
  await buildPilot(page, 'Delete Me', 'TBD')
  await waitForReady(page)

  // ── Step 2: Verify pilot appears and trigger delete ─────────────────────────
  // Wait for entity hydration to complete (hydratedAll = true)
  // and the pilot to appear in the Pilots list.
  await expect(page.getByLabel('Loading saved builds')).not.toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Delete Me')).toBeVisible({
    timeout: 15_000,
  })

  // The item's ⋯ menu, then Delete….
  await page.getByRole('button', { name: 'More for Delete Me' }).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()

  // ── Step 3: Confirm dialog ──────────────────────────────────────────────────
  // ConfirmDialog renders the "Delete {name}?" title twice (the visible header
  // stamp + the sr-only Dialog.Title), so assert containment on the dialog
  // rather than a unique text locator.
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alertdialog')).toContainText('Delete Delete Me?')

  // Confirm button inside the dialog.
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Delete$/ })
    .click()

  // ── Step 4: Pilot should vanish from the list ───────────────────────────────
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Delete Me')).not.toBeVisible(
    { timeout: 10_000 }
  )
})

test('cancel delete keeps the pilot visible', async ({ page }) => {
  // ── Step 1: Build a minimal pilot ──────────────────────────────────────────
  await buildPilot(page, 'Keep Me', 'OK')
  await waitForReady(page)

  // ── Step 2: Verify pilot appears and open delete dialog ─────────────────────
  await expect(page.getByLabel('Loading saved builds')).not.toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Keep Me')).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'More for Keep Me' }).click()
  await page.getByRole('menuitem', { name: 'Delete…' }).click()

  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 10_000 })

  // ── Step 3: Cancel keeps the entity ─────────────────────────────────────────
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Cancel/ })
    .click()
  await expect(page.getByRole('region', { name: 'Pilots' }).getByText('Keep Me')).toBeVisible({
    timeout: 5_000,
  })
})
