import type { Page } from '@playwright/test'
import { buildPilot, gotoStable, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

/**
 * Shelves — everything you keep (board S1).
 *
 * Signed in (the default `test` from `fixtures.ts`), so each spec SKIPS with a
 * stated reason in a build with no test sign-in seam and runs for real in the
 * nightly `e2e-cantina` job: moving, copying and importing are all Convex writes.
 */

async function openShelves(page: Page): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Hangar' })).toBeVisible({
    timeout: 15_000,
  })
}

/** An item's ⋯ menu, then one of its rows. */
async function fromMenu(page: Page, name: string, row: string): Promise<void> {
  await page.getByRole('button', { name: `More for ${name}` }).click()
  await page.getByRole('menuitem', { name: row }).click()
}

function showing(page: Page, option: 'Everything' | 'Unassigned') {
  return page.getByRole('group', { name: 'Showing' }).getByRole('button', { name: option })
}

test('move a unit into a Game and back: it never leaves the shelf', async ({ page }) => {
  await buildPilot(page, 'Shelf Runner', 'Runner')

  // A Game to move it into.
  await openShelves(page)
  await page.getByRole('button', { name: '+ New Game' }).click()
  await page.getByLabel('New Game name').fill('Dustbowl Run')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/games\//, { timeout: 20_000 })

  await openShelves(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Shelf Runner')).toBeVisible({ timeout: 15_000 })
  await expect(pilots.getByText('Unassigned')).toBeVisible()

  // In: one pick, no confirm (nothing is linked to it).
  await fromMenu(page, 'Shelf Runner', 'Move to a Game…')
  await page
    .getByRole('list', { name: 'Where to' })
    .getByRole('button', { name: 'Dustbowl Run' })
    .click()
  await expect(pilots.getByText('Dustbowl Run')).toBeVisible({ timeout: 15_000 })

  // Still on the shelf under Everything; under Unassigned it is not.
  await showing(page, 'Unassigned').click()
  await expect(pilots.getByText('Shelf Runner')).toHaveCount(0)
  await showing(page, 'Everything').click()
  await expect(pilots.getByText('Shelf Runner')).toBeVisible()

  // Out again: taking it off a table's roster always asks.
  await fromMenu(page, 'Shelf Runner', 'Move to a Game…')
  await page
    .getByRole('list', { name: 'Where to' })
    .getByRole('button', { name: 'Unassigned' })
    .click()
  await page.getByRole('alertdialog').getByRole('button', { name: /^Move/ }).click()
  await expect(pilots.getByText('Unassigned')).toBeVisible({ timeout: 15_000 })
  await expect(pilots.getByText('Dustbowl Run')).toHaveCount(0)
})

test('copy a pilot from the Starter Set onto the shelf', async ({ page }) => {
  await openShelves(page)

  await page
    .getByRole('region', { name: 'Starter Set' })
    .getByRole('link', { name: 'Read Bonesaw' })
    .click()
  await page.waitForURL(/\/starter\/pilot\//, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Make a copy' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Make a copy' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0, { timeout: 15_000 })

  await openShelves(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Bonesaw')).toBeVisible({ timeout: 15_000 })
})

test('export the shelf, and import it back', async ({ page }) => {
  await buildPilot(page, 'Backed Up', 'Bak')
  await openShelves(page)
  const pilots = page.getByRole('region', { name: 'Pilots' })
  await expect(pilots.getByText('Backed Up')).toBeVisible({ timeout: 15_000 })

  // Export all: one dated backup file.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toMatch(/^cantina-backup-\d{4}-\d{2}-\d{2}\.json$/)
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
