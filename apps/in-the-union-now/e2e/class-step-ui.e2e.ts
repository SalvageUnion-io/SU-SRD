import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Visual / interactive contract for the ClassStep master-detail layout:
 *  - Every base class renders as a selectable row (div[role="button"] with
 *    aria-pressed).
 *  - Selecting a row marks exactly that row aria-pressed="true".
 *  - The detail pane then renders the selected class's full card with its
 *    ability trees expanded (no per-card disclosure) — tree names and a known
 *    L1 ability are visible without any extra interaction.
 *
 * Guards against the recurring regression class: selection state drops out,
 * the detail pane fails to mount, ability listing fails to render.
 */
test('selecting a class marks it selected and reveals its trees', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Pre-selection: no row is pressed.
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0)

  await pickByName(page, 'Engineer')

  // Post-selection: exactly one pressed row, and it is the Engineer row.
  const pressed = page.getByRole('button', { pressed: true })
  await expect(pressed).toHaveCount(1)
  await expect(pressed).toContainText('Engineer')

  // The detail pane renders the Engineer ability trees with no disclosure to
  // open. Engineer core trees: Mechanical Knowledge, Forging, Mech-Tech.
  await expect(page.getByText(/Mech-Tech/i).first()).toBeVisible()
})

test('switching class moves the selection', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await expect(page.getByRole('button', { pressed: true })).toContainText('Engineer')

  await pickByName(page, 'Scout')
  const pressed = page.getByRole('button', { pressed: true })
  await expect(pressed).toHaveCount(1)
  await expect(pressed).toContainText('Scout')

  // The detail pane now shows Scout's trees. Scout core trees: Recon, Sleuth,
  // Sniper — "Sleuth" is unambiguous (the description mentions reconnaissance).
  await expect(page.getByText(/Sleuth/i).first()).toBeVisible()
})
