import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import { gotoStable, waitForReady } from './_helpers'
import { requireSeam, seamIsPresent, signInFresh } from './fixtures'

/**
 * Running a table needs two people: the Organizer (the spec's own `page`,
 * signed in by `fixtures.ts`) and a second account in a context of its own.
 * These are the steps the Mediator, Dashboard and signed-in a11y specs share
 * (issue 1278, board M2).
 */

/** "+ New game" from Shelves, named; resolves to the new Game's id. */
export async function createGame(page: Page, name: string): Promise<string> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New game' }).click()
  await page.getByLabel('New game name').fill(name)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.waitForURL(/\/games\/[^/]+$/, { timeout: 20_000 })
  const id = new URL(page.url()).pathname.split('/').pop()
  if (!id) throw new Error(`No Game id in ${page.url()}`)
  // The Game's own page is up: its band names it.
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible({ timeout: 20_000 })
  return id
}

/**
 * Make a link from the Game page's New link form and read its token off the
 * newest open link's card. Approval is unchecked by default (ADR-030's invite
 * amendment), so `approval` ticks it.
 */
export async function makeInviteLink(page: Page, { approval }: { approval: boolean }) {
  const before = await page.getByRole('list', { name: 'Open invite links' }).locator('li').count()
  if (approval) await page.getByLabel('I approve each person who uses it').check()
  await page.getByRole('button', { name: 'Make link' }).click()
  const cards = page.getByRole('list', { name: 'Open invite links' }).locator('li')
  await expect(cards).toHaveCount(before + 1, { timeout: 15_000 })
  // Newest first: the link just made heads the list.
  const url = (await cards.first().locator('code').innerText()).trim()
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
 * the page on the Game's own page, with its Launch Dashboard button showing.
 */
export async function setUpTable(page: Page): Promise<void> {
  await gotoStable(page, '/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start this game' }).first().click()
  // The Organizer appoints the Mediator, here themselves (TheGame's Appoint).
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await expect(page.getByRole('button', { name: 'Launch Dashboard' })).toBeVisible({
    timeout: 20_000,
  })
  await pickUp(page, 'Bonesaw')
  await pickUp(page, 'Scrapper')
}
