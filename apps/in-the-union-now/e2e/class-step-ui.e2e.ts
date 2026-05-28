import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Visual / interactive contract for the ClassStep card grid:
 *  - Every base class renders as a clickable card (div[role="button"]).
 *  - Selecting a card injects a "Selected" aria-labelled control on the
 *    chosen card and nowhere else.
 *  - Selecting the class reveals the SRD ClassAbilityTreeDisplay block
 *    below the grid (titled "<Class> — Trees & Abilities").
 *
 * Guards against the recurring regression class: hover/cursor wiring drops
 * out, selection ring disappears, ability listing fails to mount.
 */
test('selecting a class renders Selected indicator and trees listing', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Pre-selection: no Selected control should exist.
  expect(await page.getByLabel(/^Selected/).count()).toBe(0)

  await pickByName(page, 'Engineer')

  // Post-selection: exactly one Selected control on the chosen card.
  const selected = page.getByLabel(/^Selected/)
  await expect(selected).toHaveCount(1)

  // Tree listing should appear under the card grid.
  await expect(page.getByText(/Engineer — Trees & Abilities/i)).toBeVisible()
  // And at least one of Engineer's core tree names should render in the
  // ClassAbilityTreeDisplay block.
  await expect(page.getByText(/Mechanical Knowledge/i).first()).toBeVisible()
})

test('switching class moves the Selected indicator', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await expect(page.getByLabel(/^Selected/)).toHaveCount(1)

  await pickByName(page, 'Scout')
  await expect(page.getByLabel(/^Selected/)).toHaveCount(1)
  await expect(page.getByText(/Scout — Trees & Abilities/i)).toBeVisible()
})
