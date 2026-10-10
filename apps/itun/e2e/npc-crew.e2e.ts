import { buildCrawler, editSheet, gotoStable, openSheetFor, waitForReady } from './_helpers'
import { expect, test } from './fixtures'

/**
 * The #1277 Gate: build an NPC from a template, assign it to a crawler bay,
 * and unassign it to fall back to the book's crew line (boards N1 and N2;
 * ADR-043).
 *
 * Signed in (the default `test` from `fixtures.ts`), so it SKIPS with a stated
 * reason in a build with no test sign-in seam and runs for real in the nightly
 * `e2e-itun` job: the NPC and its crew link are Convex writes.
 */

/** Open the Med Bay card on the crawler sheet that is showing, and return its crew inset. */
async function medBayCrew(page: import('@playwright/test').Page) {
  const expand = page.getByRole('button', { name: 'Expand Med Bay' })
  if (await expand.count()) await expand.first().click()
  return page.getByRole('group', { name: 'Med Bay crew lead' })
}

test('design an NPC from a template, crew a bay with it, and give the bay back', async ({
  page,
}) => {
  await buildCrawler(page, 'Tin Lizzy')

  // --- N1: Any NPC, from the Veteran ---
  await gotoStable(page, '/npcs/new')
  await waitForReady(page)
  await expect(page.getByRole('heading', { level: 1, name: /Design an NPC/i })).toBeVisible()
  await page.getByRole('button', { name: 'Start from Veteran' }).click()
  await page.getByRole('button', { name: 'Next: Stats' }).click()
  await expect(page.getByLabel(/Hit points/)).toHaveValue('9')
  await page.getByRole('button', { name: 'Next: Actions & traits' }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Carry Green Laser Rifle (Veteran)' })
  ).toBeChecked()
  await page.getByRole('button', { name: 'Next: Identity' }).click()
  await page.getByLabel(/^Name/).fill('Sergeant Kessler')
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await expect(page.getByText('NPC · from Veteran').first()).toBeVisible()
  await page.getByRole('button', { name: 'Save NPC' }).click()
  await page.waitForURL(/\/sheet\/npc\//, { timeout: 20_000 })
  await expect(page.getByRole('heading', { level: 1, name: /Sergeant Kessler/i })).toBeVisible()

  // --- The crawler's Med Bay keeps the book's line until it is crewed ---
  await openSheetFor(page, 'Tin Lizzy')
  const bookCrew = await medBayCrew(page)
  await expect(bookCrew).toHaveCount(1)
  await expect(bookCrew).not.toContainText('Sergeant Kessler')
  const inlineCrewBefore = await bookCrew.innerText()
  expect(inlineCrewBefore.trim()).not.toBe('')

  // --- N2: Crawler crew, from the Bays section's one Crew… link ---
  await editSheet(page)
  await page.getByRole('link', { name: /design and assign crawler crew/i }).click()
  await page.waitForURL(/\/npcs\/new\?view=crew/, { timeout: 15_000 })
  await page.getByRole('button', { name: 'Design Med Bay crew' }).click()
  await page.getByRole('button', { name: 'Assign Sergeant Kessler to Med Bay' }).click()
  await expect(page.getByRole('button', { name: 'Med Bay: Sergeant Kessler' })).toBeVisible({
    timeout: 15_000,
  })

  // The bay shows the NPC in place of its inline crew, stamped User-made.
  await openSheetFor(page, 'Tin Lizzy')
  const crewNow = await medBayCrew(page)
  await expect(crewNow).toHaveCount(1)
  await expect(crewNow).toContainText('Sergeant Kessler')
  await expect(page.getByText('User-made crew')).toBeVisible()

  // --- Unassign: the link goes; the NPC and the book's line both survive ---
  await editSheet(page)
  await page.getByRole('link', { name: /design and assign crawler crew/i }).click()
  await page.getByRole('button', { name: 'Med Bay: Sergeant Kessler' }).click()
  await page.getByRole('button', { name: 'Unassign Sergeant Kessler from Med Bay' }).click()
  await expect(page.getByRole('button', { name: 'Design Med Bay crew' })).toBeVisible({
    timeout: 15_000,
  })

  await openSheetFor(page, 'Tin Lizzy')
  // The Gate: the inline crew is back byte for byte (P7 section 4).
  const crewAfter = await medBayCrew(page)
  await expect(crewAfter).toHaveCount(1)
  await expect(crewAfter).not.toContainText('Sergeant Kessler')
  expect(await crewAfter.innerText()).toBe(inlineCrewBefore)
  await expect(page.getByText('User-made crew')).toHaveCount(0)

  // The NPC is still on the shelf.
  await gotoStable(page, '/')
  await waitForReady(page)
  await expect(page.locator('li', { hasText: 'Sergeant Kessler' }).first()).toBeVisible()
})
