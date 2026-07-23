import { test, expect } from '@playwright/test'
import { pickByName, selectedOption, waitForReady } from './_helpers'

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
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Pre-selection: nothing is chosen.
  await expect(selectedOption(page)).toHaveCount(0)

  await pickByName(page, 'Engineer')

  // Post-selection: exactly one chosen cell, and it is the Engineer card.
  await expect(selectedOption(page)).toHaveCount(1)
  await expect(selectedOption(page)).toContainText('Engineer')

  // The detail listing renders the Engineer ability pool with no disclosure to
  // open. Engineer core trees: Mechanical Knowledge, Forging, Mech-Tech.
  await expect(page.getByText(/Mech-Tech/i).first()).toBeVisible()
})

test('switching class moves the selection', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await expect(selectedOption(page)).toContainText('Engineer')

  await pickByName(page, 'Scout')
  await expect(selectedOption(page)).toHaveCount(1)
  await expect(selectedOption(page)).toContainText('Scout')

  // The detail listing now shows Scout's trees. Scout core trees: Recon,
  // Sleuth, Sniper — "Sleuth" is unambiguous.
  await expect(page.getByText(/Sleuth/i).first()).toBeVisible()
})
