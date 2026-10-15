import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import { gotoStable, waitForReady } from './_helpers'
import { requireSeam, seamIsPresent, signInFresh } from './fixtures'

/**
 * Running a table needs two people: the Organizer (the spec's own `page`,
 * signed in by `fixtures.ts`) and a second account in a context of its own.
 * These are the steps the Mediator, Dashboard and signed-in a11y specs share
 * (board M2).
 */

/** "+ New Game" from Shelves, named; resolves to the new Game's id. */
export async function createGame(page: Page, name: string): Promise<string> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New Game' }).click()
  await page.getByLabel('New Game name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/games\/[^/]+$/, { timeout: 20_000 })
  const id = new URL(page.url()).pathname.split('/').pop()
  if (!id) throw new Error(`No Game id in ${page.url()}`)
  // The Game's own page is up: its band names it.
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible({ timeout: 20_000 })
  return id
}

/**
 * Copy the Game's invite link from its page ("Copy invite link", the
 * Organizer's) and read its token off the clipboard.
 */
export async function makeInviteLink(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy invite link' }).click()
  await expect(page.getByText('Invite link copied')).toBeVisible({ timeout: 15_000 })
  const url = (await page.evaluate(() => navigator.clipboard.readText())).trim()
  const token = /\/invite\/([^/\s]+)$/.exec(url)?.[1]
  if (!token) throw new Error(`No invite token in "${url}"`)
  return token
}

/** A second, freshly signed-up account in its own browser context. */
export async function secondAccount(
  browser: Browser,
  testInfo: TestInfo
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await gotoStable(page, '/')
  await waitForReady(page)
  requireSeam(await seamIsPresent(page), testInfo)
  await signInFresh(page)
  return { context, page }
}

/** Pick up an unclaimed pre-gen from the Game's roster. */
async function pickUp(page: Page, name: string): Promise<void> {
  const row = page.locator('li', { hasText: name }).first()
  await row.getByRole('button', { name: /— pick this up$/ }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Pick up' }).click()
  await expect(confirm).toBeHidden({ timeout: 15_000 })
}

/**
 * Start a Starter Set Game, mediate it, take Bonesaw and his Scrapper. Leaves
 * the page on the Game's own page, with its Launch Dashboard chip showing.
 */
export async function setUpTable(page: Page): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New Game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start this Game' }).first().click()
  // The Organizer appoints the Mediator, here themselves (TheGame's Appoint).
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  // The Mediator's Launch Dashboard: a link to the Mediator dashboard.
  await expect(page.getByRole('link', { name: 'Launch Dashboard' })).toBeVisible({
    timeout: 20_000,
  })
  await pickUp(page, 'Bonesaw')
  await pickUp(page, 'Scrapper')
}

/**
 * The player Dashboard route for a pilot on the Game's roster, read off its
 * Row's sheet link. The Mediator who runs `setUpTable` also plays Bonesaw, and
 * their Launch Dashboard opens the Mediator dashboard, so the specs open the
 * player Dashboard by its route.
 */
export async function pilotDashboard(page: Page, name: string): Promise<string> {
  const link = page.locator(`a[href*="/sheet/pilot/"][aria-label="${name}"]`).first()
  await expect(link, `the roster links ${name}'s sheet`).toBeAttached({ timeout: 20_000 })
  const id = (await link.getAttribute('href'))?.split('/').pop()
  if (!id) throw new Error(`${name}'s roster link has no id`)
  return `/dashboard/${id}`
}
