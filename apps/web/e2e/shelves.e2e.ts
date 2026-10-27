import { buildPilot } from './_helpers'
import { createGame } from './_table'
import { fromShelfMenu, moveToGame, openTrainingBay, shelf, showOnShelves } from './_trainingBay'
import { expect, test } from './fixtures'

/**
 * The Training Bay — everything you own (ADR-052 §1).
 *
 * Signed in (the default `test` from `fixtures.ts`), so each spec SKIPS with a
 * stated reason in a build with no test sign-in seam and runs for real in the
 * nightly `e2e` job: moving, copying, deleting and importing are all room
 * writes.
 */

test('move a unit into a Game and back: it never leaves the Training Bay', async ({ page }) => {
  await buildPilot(page, 'Shelf Runner', 'Runner')

  // A Game to move it into, started on the Play hub.
  const gameId = await createGame(page, 'Dustbowl Run')

  await openTrainingBay(page)
  const pilots = shelf(page)
  await expect(pilots.getByText('Shelf Runner')).toBeVisible({ timeout: 15_000 })
  // In no Game: no Game chip, and never an "Unassigned" one.
  await expect(pilots.getByText('Unassigned')).toHaveCount(0)

  // In: one pick, no confirm (nothing is linked to it).
  await moveToGame(page, 'Shelf Runner', 'Dustbowl Run')
  // Its Game is a relation chip opening the Game's page in Play. A Training
  // Bay row is header-only, so a chip that does not fit beside the name goes
  // into its +MORE (chip law, C5): the chip is there, maybe not drawn.
  const chip = pilots.locator('[data-chip-class="relation"] a[data-tag]', {
    hasText: 'Dustbowl Run',
  })
  await expect(chip).toBeAttached({ timeout: 15_000 })
  await expect(chip).toHaveAttribute('href', new RegExp(`/play/games/${gameId}$`))

  // Still in the Training Bay under Everything and under its Game; under Not in a Game it is not.
  await showOnShelves(page, 'Not in a Game')
  await expect(pilots.getByText('Shelf Runner')).toHaveCount(0)
  await showOnShelves(page, 'Dustbowl Run')
  await expect(pilots.getByText('Shelf Runner')).toBeVisible()
  await showOnShelves(page, 'Everything')
  await expect(pilots.getByText('Shelf Runner')).toBeVisible()

  // Out again: taking it off a table's roster always asks.
  await moveToGame(page, 'Shelf Runner', 'Not in a Game')
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
  const pilots = shelf(page)
  await expect(pilots.getByText('Bonesaw')).toBeVisible({ timeout: 15_000 })
})

test('export the shelf, and import it back', async ({ page }) => {
  await buildPilot(page, 'Backed Up', 'Bak')
  await openTrainingBay(page)
  const pilots = shelf(page)
  await expect(pilots.getByText('Backed Up')).toBeVisible({ timeout: 15_000 })

  // Export all: one dated backup file.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toMatch(/^salvageunion-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await backup.path()

  // Lose it…
  await fromShelfMenu(page, 'Backed Up', 'Delete…')
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

/**
 * Delete is in each item's ⋯ menu ("More for <name>", then "Delete…"), behind
 * the page's one confirm (`ConfirmDialog`, an alertdialog titled "Delete
 * <name>?", drawn twice: the stamp and the sr-only title, so the dialog is
 * asserted to contain it). Confirming removes the item; cancelling keeps it.
 */
test('delete a pilot from the Training Bay, and cancel a delete', async ({ page }) => {
  await buildPilot(page, 'Delete Me', 'TBD')
  await buildPilot(page, 'Keep Me', 'OK')
  await openTrainingBay(page)
  const pilots = shelf(page)
  // The account's rows arrive from the rooms after the game data is ready.
  await expect(page.getByLabel('Loading saved builds')).not.toBeVisible({ timeout: 20_000 })
  await expect(pilots.getByText('Delete Me')).toBeVisible({ timeout: 15_000 })
  await expect(pilots.getByText('Keep Me')).toBeVisible()

  const confirm = page.getByRole('alertdialog')
  await fromShelfMenu(page, 'Delete Me', 'Delete…')
  await expect(confirm).toContainText('Delete Delete Me?')
  await confirm.getByRole('button', { name: /^Delete$/ }).click()
  await expect(pilots.getByText('Delete Me')).toHaveCount(0, { timeout: 10_000 })

  await fromShelfMenu(page, 'Keep Me', 'Delete…')
  await expect(confirm).toBeVisible({ timeout: 10_000 })
  await confirm.getByRole('button', { name: /Cancel/ }).click()
  await expect(confirm).toBeHidden()
  await expect(pilots.getByText('Keep Me')).toBeVisible()
})
