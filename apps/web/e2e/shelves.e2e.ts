import type { Page } from '@playwright/test'
import { buildPilot, gotoStable, waitForReady } from './_helpers'
import { createGame } from './_table'
import { expect, test } from './fixtures'

/**
 * The Training Bay — everything you own (ADR-052 §1).
 *
 * Signed in (the default `test` from `fixtures.ts`), so each spec SKIPS with a
 * stated reason in a build with no test sign-in seam and runs for real in the
 * nightly `e2e` job: moving, copying and importing are all Convex writes.
 */

async function openTrainingBay(page: Page): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Training Bay' })).toBeVisible({
    timeout: 15_000,
  })
}

/** An item's ⋯ menu, then one of its rows. */
async function fromMenu(page: Page, name: string, row: string): Promise<void> {
  await page.getByRole('button', { name: `More for ${name}` }).click()
  await page.getByRole('menuitem', { name: row }).click()
}

/** The band's Showing select. */
async function show(page: Page, option: string): Promise<void> {
  await page.getByLabel('Showing').selectOption({ label: option })
}

test('move a unit into a Game and back: it never leaves the Training Bay', async ({ page }) => {
  await buildPilot(page, 'Shelf Runner', 'Runner')

  // A Game to move it into, started on the Play hub.
  const gameId = await createGame(page, 'Dustbowl Run')

  await openTrainingBay(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Shelf Runner')).toBeVisible({ timeout: 15_000 })
  // In no Game: no Game chip, and never an "Unassigned" one.
  await expect(pilots.getByText('Unassigned')).toHaveCount(0)

  // In: one pick, no confirm (nothing is linked to it).
  await fromMenu(page, 'Shelf Runner', 'Move to a Game…')
  await page
    .getByRole('list', { name: 'Where to' })
    .getByRole('button', { name: 'Dustbowl Run' })
    .click()
  // Its Game is a relation chip opening the Game's page in Play. A Training
  // Bay row is header-only, so a chip that does not fit beside the name goes
  // into its +MORE (chip law, C5): the chip is there, maybe not drawn.
  const chip = pilots.locator('[data-chip-class="relation"] a[data-tag]', {
    hasText: 'Dustbowl Run',
  })
  await expect(chip).toBeAttached({ timeout: 15_000 })
  await expect(chip).toHaveAttribute('href', new RegExp(`/play/games/${gameId}$`))

  // Still in the Training Bay under Everything and under its Game; under Not in a Game it is not.
  await show(page, 'Not in a Game')
  await expect(pilots.getByText('Shelf Runner')).toHaveCount(0)
  await show(page, 'Dustbowl Run')
  await expect(pilots.getByText('Shelf Runner')).toBeVisible()
  await show(page, 'Everything')
  await expect(pilots.getByText('Shelf Runner')).toBeVisible()

  // Out again: taking it off a table's roster always asks.
  await fromMenu(page, 'Shelf Runner', 'Move to a Game…')
  await page
    .getByRole('list', { name: 'Where to' })
    .getByRole('button', { name: 'Not in a Game' })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: /^Move/ }).click()
  await expect(pilots.getByText('Dustbowl Run')).toHaveCount(0, { timeout: 15_000 })
})

test('copy a pilot from the Starter Set onto the shelf', async ({ page }) => {
  await openTrainingBay(page)

  // The Starter Set is folded under its Slab until its fold opens it.
  await page.getByRole('button', { name: 'Expand Starter Set' }).click()
  await page
    .getByRole('region', { name: 'Starter Set' })
    .getByRole('link', { name: 'Read Bonesaw' })
    .click()
  await page.waitForURL(/\/starter\/pilot\//, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Make a copy' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Make a copy' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 15_000 })

  await openTrainingBay(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Bonesaw')).toBeVisible({ timeout: 15_000 })
})

test('export the shelf, and import it back', async ({ page }) => {
  await buildPilot(page, 'Backed Up', 'Bak')
  await openTrainingBay(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Backed Up')).toBeVisible({ timeout: 15_000 })

  // Export all: one dated backup file.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toMatch(/^salvageunion-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await backup.path()

  // Lose it…
  await fromMenu(page, 'Backed Up', 'Delete…')
  const confirmDelete = page.getByRole('alertdialog')
  await confirmDelete.getByRole('button', { name: 'Delete' }).click()
  await expect(pilots.getByText('Backed Up')).toHaveCount(0, { timeout: 15_000 })
  // The row leaves with the server's answer; the dialog closes only once the
  // delete has also left this device's cache. Importing before then counts the
  // cached row as a duplicate and skips it.
  await expect(confirmDelete).toBeHidden({ timeout: 15_000 })

  // …and import it back from the file.
  await page.locator('input[type="file"]').setInputFiles(file)
  await expect(pilots.getByText('Backed Up')).toBeVisible({ timeout: 20_000 })
})
