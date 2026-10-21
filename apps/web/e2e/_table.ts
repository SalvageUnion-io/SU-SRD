import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import { gotoStable, waitForReady } from './_helpers'
import { requireSeam, seamIsPresent, signInFresh } from './fixtures'

/**
 * Running a table needs two people: the Organizer (the spec's own `page`,
 * signed in by `fixtures.ts`) and a second account in a context of its own.
 * These are the steps the Play and signed-in a11y specs share.
 */

/**
 * "+ New Game" and the invite link: the seeded account's own steps
 * (`gates/lib/seedAccount.ts`), so a change to either is made once.
 */
export { createGame, makeInviteLink } from 'gates/lib/seedAccount'

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

/**
 * Pick up an unclaimed pre-gen from the Game's Crew: the row naming it that
 * still offers a pick-up (a pilot's row names its mech too, as a linked Mini).
 */
async function pickUp(page: Page, name: string): Promise<void> {
  const seal = page.getByRole('button', { name: /— pick this up$/ })
  const row = page.locator('li', { hasText: name }).filter({ has: seal }).last()
  await row.getByRole('button', { name: /— pick this up$/ }).click()
  const confirm = page.getByRole('alertdialog')
  await confirm.getByRole('button', { name: 'Pick up' }).click()
  await expect(confirm).toBeHidden({ timeout: 15_000 })
}

/**
 * Start a Starter Set Game, mediate it, take Bonesaw and his Scrapper. Leaves
 * the page on the Game's own page; resolves to the Game's id and name, which
 * the Play landing's doors are named by ("Play Bonesaw in <name>").
 *
 * The Mediator is waited for by the band's YOU MEDIATE stamp, not by the way
 * in it offers: that door moves to Play (ADR-051) while the stamp stays.
 */
export async function setUpTable(page: Page): Promise<{ gameId: string; gameName: string }> {
  await gotoStable(page, '/play/')
  await waitForReady(page)
  await page.getByRole('button', { name: '+ New Game' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start this Game' }).first().click()
  await page.waitForURL(/\/play\/games\/[^/]+$/, { timeout: 20_000 })
  // The Organizer appoints the Mediator, here themselves (TheGame's Appoint).
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await expect(page.getByText('You mediate')).toBeVisible({ timeout: 20_000 })
  await pickUp(page, 'Bonesaw')
  await pickUp(page, 'Scrapper')
  const gameId = new URL(page.url()).pathname.split('/').pop() ?? ''
  const gameName = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim()
  if (!gameId || !gameName) throw new Error(`No Game id or name on ${page.url()}`)
  return { gameId, gameName }
}
