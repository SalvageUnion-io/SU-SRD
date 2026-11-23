import type { Page } from '@playwright/test'
import { escapeRegExp, pageOverflow } from './_helpers'
import {
  actionsOnHand,
  axeViolations,
  board,
  expectNoPageScroll,
  moreMenu,
  openPlay,
  PHONE,
  pilotPlayPath,
  pinnedVitals,
  situation,
  WIDE,
} from './_play'
import { findSearchWidths } from './_searchWidth'
import { setUpTable } from './_table'
import { expect, test } from './fixtures'

/**
 * A boarded turn in Play (play.md §3, §5, §8, §11): Board from the Situation
 * switch, Use an action from the list, Activate, Roll and Done in its row,
 * and the roll on the Feed. Once in a 1440 × 900 window, on the three columns,
 * and once on a 390 × 844 phone, where Board is a row in ⋯, the list is the
 * Act tab and the Feed is on Rolls. The page never
 * scrolls on the way, at 1440, 1024 and 390, and axe finds nothing there.
 *
 * ## The table
 *
 * A Game started from the Starter Set template, with the signed-in account as
 * its Mediator (ADR-038 §1). It picks up Bonesaw and his Scrapper, so the
 * pilot is in this browser and the Scrapper is his to board. Bonesaw is opened
 * from the Play landing's door, "Open table as Bonesaw in <Game>".
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

/** Board, Use, Activate, Roll, Done; resolves to the action's name. */
async function boardedTurn(page: Page): Promise<string> {
  await board(page, 'Scrapper')

  // The first action on hand that can run as it stands, pinned by its key:
  // once used, its Use button becomes Cancel, and a locator filtered on Use
  // would slide on to the next row.
  const onHand = actionsOnHand(page)
  const key = await onHand
    .and(page.locator(':not([data-locked])'))
    .filter({ has: page.getByRole('button', { name: /^Use / }) })
    .first()
    .getAttribute('data-action-key')
  expect(key, 'an action on hand to use').toBeTruthy()
  const row = onHand.and(page.locator(`[data-action-key="${key}"]`))
  const use = row.getByRole('button', { name: /^Use / })
  const name = ((await use.getAttribute('aria-label')) ?? '').replace(/^Use /, '')
  expect(name, 'an action on hand to use').not.toBe('')
  await use.click()
  await expect(row).toHaveAttribute('data-open', 'true')
  await expect(row.getByRole('button', { name: `Cancel ${name}` })).toBeVisible()

  // Activate pays the cost where there is one to pay; a free action has none, nor an attack (r5 A16).
  const activate = row.getByRole('button', { name: 'Activate', exact: true })
  if ((await activate.count()) > 0 && (await activate.isEnabled())) {
    await activate.click()
    await expect(row.getByRole('button', { name: 'Activated ✓' })).toBeVisible()
  }

  // The roll is the Core Mechanic table's stamp; the result its marked row (R8).
  await row.getByRole('button', { name: 'Roll the die on Core Mechanic' }).click()
  const marked = row.locator('.su-roll [aria-current="true"]')
  await expect(marked.locator('.su-roll__tag')).toHaveText('Rolled 14')
  await expect(marked.locator('.su-roll__label')).toHaveText('Success')

  // A Success writes nothing to a unit: no Apply, the row's Done finishes it (r6 A5).
  await expect(row.getByRole('button', { name: 'Apply', exact: true })).toHaveCount(0)
  await row.getByRole('button', { name: `Done with ${name}` }).click()
  // A finished action closes itself and reads Done (LG-12); the finish is said once, as a status.
  await expect(row).toHaveAttribute('data-done', 'true')
  await expect(row).not.toHaveAttribute('data-open', 'true')
  await expect(row.getByRole('status')).toHaveText('Rolled 14 · Success')
  await expect(row.getByText('Done', { exact: true })).toBeVisible()
  return name
}

/** My roll's line on the Feed: "You · <action> · 14 · Success". */
async function expectOnFeed(page: Page, action: string): Promise<void> {
  const feed = page.getByRole('list', { name: 'Feed' })
  await expect(feed.getByText(new RegExp(`^You · ${escapeRegExp(action)} · 14\\b`))).toBeVisible({
    timeout: 15_000,
  })
}

test('a boarded turn on the columns: board, use, roll, apply', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(8 * 60_000)
  await setUpTable(page)
  const play = await pilotPlayPath(page, 'Bonesaw')
  await page.setViewportSize({ width: WIDE.width, height: WIDE.height })
  await openPlay(page, play, { dice: true })

  // On foot: the Situation says so, the screen fits, and axe finds nothing.
  await expect(situation(page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(actionsOnHand(page).first()).toBeVisible()
  await expectNoPageScroll(page, 'player in a Game, On foot')
  const a11y = await axeViolations(page, 'player in a Game, On foot')

  const action = await boardedTurn(page)
  await expectOnFeed(page, action)
  await expectNoPageScroll(page, 'player in a Game, Boarded, resolving')
  a11y.push(...(await axeViolations(page, 'player in a Game, Boarded, resolving')))

  // Back on foot from the switch.
  await situation(page).getByRole('button', { name: 'On foot' }).click()
  await expect(situation(page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 }
  )
  expect(a11y, 'accessibility violations on the Play screen').toEqual([])
})

test('a boarded turn on a 390 × 844 phone: the Act tab, then Rolls', { tag: '@pr' }, async ({
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
  const pinned = pinnedVitals(page)
  await expect(pinned.getByRole('button', { name: /^Bonesaw HP / })).toBeVisible()
  // The Act tab's Find spans its line (a search is full width on a phone).
  expect(await findSearchWidths(page), 'Act tab searches narrower than their line').toEqual([])

  const action = await boardedTurn(page)
  // Boarded, the mech's vitals are pinned too.
  await expect(pinned.getByRole('button', { name: /^Scrapper SP / })).toBeVisible()

  await tabs.getByRole('tab', { name: 'Rolls' }).click()
  await expectOnFeed(page, action)
  expect(await findSearchWidths(page), 'Rolls tab searches narrower than their line').toEqual([])

  // The tabs fit the screen: only the open pane scrolls.
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

  await expect(page.getByRole('tablist', { name: 'Play' })).toBeVisible({ timeout: 30_000 })
  await (await moreMenu(page)).getByRole('menuitem', { name: 'Table mode' }).click()
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
