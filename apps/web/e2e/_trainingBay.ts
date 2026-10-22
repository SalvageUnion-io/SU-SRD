import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { openApp } from './_helpers'

/**
 * The Training Bay (`/`, ADR-052 §1): everything an account owns, on shelves
 * by kind. What the specs that read or change a shelf share.
 */

/** Open the Training Bay and wait for its band. */
export async function openTrainingBay(page: Page): Promise<void> {
  await openApp(page, '/')
  await expect(page.getByRole('heading', { level: 1, name: 'Training Bay' })).toBeVisible({
    timeout: 15_000,
  })
}

/** One shelf, by its region's name: `Pilots`, `Mechs`, `Crawlers`, `NPCs`. */
export function shelf(page: Page, name = 'Pilots'): Locator {
  return page.getByRole('region', { name })
}

/** An item's ⋯ menu ("More for <name>"), then one of its rows (`Delete…`, `Move to a Game…`). */
export async function fromShelfMenu(page: Page, name: string, row: string): Promise<void> {
  await page
    .getByRole('button', { name: `More for ${name}` })
    .first()
    .click()
  await page.getByRole('menuitem', { name: row }).click()
}

/** The band's Showing select: `Everything`, `Not in a Game`, or a Game by name. */
export async function showOnShelves(page: Page, option: string): Promise<void> {
  await page.getByLabel('Showing').selectOption({ label: option })
}

/** Move an item into a Game, or out (`Not in a Game`, which asks first), from its ⋯ menu. */
export async function moveToGame(page: Page, name: string, where: string): Promise<void> {
  await fromShelfMenu(page, name, 'Move to a Game…')
  await page.getByRole('list', { name: 'Where to' }).getByRole('button', { name: where }).click()
}
