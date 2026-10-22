import type { Page } from '@playwright/test'
import { escapeRegExp, pageOverflow } from './_helpers'
import {
  axeViolations,
  board,
  CANVAS,
  expectNoPageScroll,
  openPlay,
  PHONE,
  pilotPlayPath,
  situation,
} from './_play'
import { findSearchWidths } from './_searchWidth'
import { setUpTable } from './_table'
import { expect, test } from './fixtures'

/**
 * A boarded turn in Play (play.md §3, §5, §8): Board from the Situation switch, Use an action from the flattened
 * list, Activate, Roll and Apply in its row, and the roll on the Feed. Once on
 * the 1280 × 800 canvas and once on a 390 × 844 phone, where the list is the
 * Act tab and the Feed is on Tables. The page never scrolls on the way.
 *
 * ## The table
 *
 * A Game started from the Starter Set template, with the signed-in account as
 * its Mediator (ADR-038 §1). It picks up Bonesaw and his Scrapper, so the
 * pilot is in this browser and the Scrapper is his to board. Bonesaw is opened
 * from the Play landing's door, "Play Bonesaw in <Game>".
 *
 * ## The dice
 *
 * Every die is Randsum's, one `Math.random()` draw per face. Once the screen
 * is up, every draw answers 13/20, so every d20 lands on 14: a Success
 * (`seedDice`, and why it waits for the socket: `openPlay`).
 *
 * Skips without the test sign-in seam, like every signed-in spec
 * (`fixtures.ts`); ci.yml's `build-web` carries the seam and runs it on every
 * PR, and the nightly `e2e` job again.
 */

/** Board, Use, Activate, Roll, Apply; resolves to the action's name. */
async function boardedTurn(page: Page): Promise<string> {
  await board(page, 'Scrapper')
  await expect(page.getByText('On hand · In Scrapper')).toBeVisible({ timeout: 15_000 })

  // The first action on hand that can run as it stands, pinned by its key:
  // once used, its Use button becomes Cancel, and a locator filtered on Use
  // would slide on to the next row.
  const onHand = page.getByRole('list', { name: 'On hand' })
  const key = await onHand
    .locator('li.su-play-act:not([data-locked])')
    .filter({ has: page.getByRole('button', { name: /^Use / }) })
    .first()
    .getAttribute('data-action-key')
  expect(key, 'an action on hand to use').toBeTruthy()
  const row = onHand.locator(`li.su-play-act[data-action-key="${key}"]`)
  const use = row.getByRole('button', { name: /^Use / })
  const name = ((await use.getAttribute('aria-label')) ?? '').replace(/^Use /, '')
  expect(name, 'an action on hand to use').not.toBe('')
  await use.click()
  await expect(row).toHaveAttribute('data-open', 'true')
  await expect(row.getByRole('button', { name: `Cancel ${name}` })).toBeVisible()

  // Activate pays the cost where there is one to pay.
  const activate = row.getByRole('button', { name: 'Activate', exact: true })
  if (await activate.isEnabled()) {
    await activate.click()
    await expect(row.getByRole('button', { name: 'Activated ✓' })).toBeVisible()
  }

  // The roll is the Core Mechanic table's stamp; the result its marked row (R8).
  await row.getByRole('button', { name: 'Roll the die on Core Mechanic' }).click()
  const marked = row.locator('.su-roll [aria-current="true"]')
  await expect(marked.locator('.su-roll__tag')).toHaveText('Rolled 14')
  await expect(marked.locator('.su-roll__label')).toHaveText('Success')

  await row.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Applied', exact: true })).toBeDisabled()
  await expect(row.getByText('Result applied ✓')).toBeVisible()
  return name
}

/** My roll's line on the Feed: "You · <action> · 14 · Success". */
async function expectOnFeed(page: Page, action: string): Promise<void> {
  const feed = page.getByRole('list', { name: 'Feed' })
  await expect(feed.getByText(new RegExp(`^You · ${escapeRegExp(action)} · 14\\b`))).toBeVisible({
    timeout: 15_000,
  })
}

test('a boarded turn on the canvas: board, use, roll, apply', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(8 * 60_000)
  await setUpTable(page)
  const play = await pilotPlayPath(page, 'Bonesaw')
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  await openPlay(page, play, { dice: true })

  // On foot: the Situation says so, the screen fits, and axe finds nothing.
  await expect(situation(page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(page.getByText('On hand · On foot')).toBeVisible()
  await expectNoPageScroll(page, 'player in a Game, On foot')
  const a11y = await axeViolations(page, 'player in a Game, On foot')

  const action = await boardedTurn(page)
  await expectOnFeed(page, action)
  await expectNoPageScroll(page, 'player in a Game, Boarded, resolving')
  a11y.push(...(await axeViolations(page, 'player in a Game, Boarded, resolving')))

  // Back on foot from the switch.
  await situation(page).getByRole('button', { name: 'On foot' }).click()
  await expect(page.getByText('On hand · On foot')).toBeVisible({ timeout: 15_000 })
  expect(a11y, 'accessibility violations on the Play screen').toEqual([])
})

test('a boarded turn on a 390 × 844 phone: the Act tab, then Tables', { tag: '@pr' }, async ({
  page,
}) => {
  test.setTimeout(6 * 60_000)
  await setUpTable(page)
  const play = await pilotPlayPath(page, 'Bonesaw')
  // The account signs in at the desktop viewport, where its readiness signal
  // is on screen; the phone takes over once the table is set.
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
  await openPlay(page, play, { dice: true })

  const tabs = page.getByRole('tablist', { name: 'Play' })
  await expect(tabs).toBeVisible({ timeout: 30_000 })
  await expect(tabs.getByRole('tab', { name: 'Act' })).toHaveAttribute('aria-selected', 'true')
  const pinned = page.getByRole('region', { name: 'Pinned vitals' })
  await expect(pinned.getByRole('list', { name: 'Bonesaw’s vitals' })).toBeVisible()
  // The Act tab's Find spans its line (a search is full width on a phone).
  expect(await findSearchWidths(page), 'Act tab searches narrower than their line').toEqual([])

  const action = await boardedTurn(page)
  // Boarded, the mech's vitals are pinned too.
  await expect(pinned.getByRole('list', { name: 'Scrapper’s vitals' })).toBeVisible()

  await tabs.getByRole('tab', { name: 'Tables' }).click()
  await expectOnFeed(page, action)
  expect(await findSearchWidths(page), 'Tables tab searches narrower than their line').toEqual([])

  // The phone form fits the screen: only the open panel scrolls.
  const { down, across } = await pageOverflow(page)
  expect(Math.max(down, across), 'the phone page scrolls (px)').toBeLessThanOrEqual(0)
})

test('table mode on a 390 × 844 phone: one tap a roll, one tap a vital, remembered', {
  tag: '@pr',
}, async ({ page }) => {
  test.setTimeout(6 * 60_000)
  await setUpTable(page)
  const play = await pilotPlayPath(page, 'Bonesaw')
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height })
  await openPlay(page, play, { dice: true })

  const toggle = page.getByRole('button', { name: 'Table mode' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false', { timeout: 30_000 })
  await toggle.click()
  const table = page.getByRole('region', { name: 'Table mode' })
  await expect(table).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Play' })).toBeHidden()

  // One tap: the Core Mechanic, on the Feed like any roll (every d20 is 14).
  await table.getByRole('button', { name: 'Roll the die' }).click()
  await expect(table.getByRole('status')).toHaveAccessibleName(/^Rolled 14, /)

  // One tap: HP down one, written as the Units column writes it.
  const hp = table.getByRole('group', { name: /^HP / })
  const before = await hp.getAttribute('aria-label')
  await table.getByRole('button', { name: 'Decrease HP' }).click()
  await expect(hp).not.toHaveAttribute('aria-label', before ?? '')

  // The device remembers it, and the page still never scrolls.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Table mode' })).toBeVisible({ timeout: 30_000 })
  const { down, across } = await pageOverflow(page)
  expect(Math.max(down, across), 'the phone page scrolls (px)').toBeLessThanOrEqual(0)
})
