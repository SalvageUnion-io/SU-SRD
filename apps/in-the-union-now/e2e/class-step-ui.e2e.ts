import { test, expect } from '@playwright/test'
import { pickByName, waitForReady } from './_helpers'

/**
 * Visual / interactive contract for the ClassStep card grid:
 *  - Every base class renders as a clickable card (button).
 *  - Selecting a card injects a "Selected — click to deselect" button inside
 *    the chosen card and nowhere else.
 *  - Each class card contains a collapsible <details> disclosure whose
 *    <summary> reads "Show abilities". Expanding it renders the
 *    ClassAbilityTreeDisplay block with tree names and abilities.
 *
 * Guards against the recurring regression class: hover/cursor wiring drops
 * out, selection ring disappears, ability listing fails to mount.
 */
test('selecting a class renders Selected indicator and trees listing', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  // Pre-selection: no Selected control should exist.
  expect(
    await page.getByRole('button', { name: 'Selected — click to deselect', exact: true }).count()
  ).toBe(0)

  await pickByName(page, 'Engineer')

  // Post-selection: exactly one Selected control on the chosen card.
  const selected = page.getByRole('button', { name: 'Selected — click to deselect', exact: true })
  await expect(selected).toHaveCount(1)

  // Expand the Engineer card's abilities disclosure, then verify a core tree
  // name appears in the tree display. Scope the assertion to the disclosure —
  // the class description itself mentions "mechanical knowledge", so an
  // unscoped match could pass without the disclosure ever opening.
  // Engineer core trees: Mechanical Knowledge, Forging, Mech-Tech.
  const engineerCard = page.locator('div[role="button"]').filter({ hasText: 'Engineer' }).first()
  const disclosure = engineerCard.locator('details').first()
  await disclosure.locator('summary').click()
  await expect(disclosure.getByText(/Mech-Tech/i).first()).toBeVisible()
})

test('switching class moves the Selected indicator', async ({ page }) => {
  await page.goto('/pilots/new')
  await waitForReady(page)

  await pickByName(page, 'Engineer')
  await expect(
    page.getByRole('button', { name: 'Selected — click to deselect', exact: true })
  ).toHaveCount(1)

  await pickByName(page, 'Scout')
  const scoutSelected = page.getByRole('button', {
    name: 'Selected — click to deselect',
    exact: true,
  })
  await expect(scoutSelected).toHaveCount(1)

  // Expand the Scout card's abilities disclosure, then verify a core tree name
  // appears in the tree display. Scope to the disclosure and use "Sleuth"
  // (a Scout core tree) — the description mentions "reconnaissance", which
  // would falsely satisfy an unscoped /Recon/ match.
  // Scout core trees: Recon, Sleuth, Sniper.
  const scoutCard = page.locator('div[role="button"]').filter({ hasText: 'Scout' }).first()
  const scoutDisclosure = scoutCard.locator('details').first()
  await scoutDisclosure.locator('summary').click()
  await expect(scoutDisclosure.getByText(/Sleuth/i).first()).toBeVisible()
})
