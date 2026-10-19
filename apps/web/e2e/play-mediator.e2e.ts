import type { Page } from '@playwright/test'
import { buildPilot, gotoStable, waitForReady } from './_helpers'
import {
  axeViolations,
  expectNoPageScroll,
  gameState,
  openPlay,
  playDoor,
  situation,
} from './_play'
import { createGame, makeInviteLink, secondAccount } from './_table'
import { expect, test } from './fixtures'

/**
 * The Mediator runs the table from Play, and the player answers from theirs
 * (play.md §8, §10; wireframes mediator-scene, mediator-downtime and
 * player-downtime).
 *
 * The Organizer makes a Game and appoints themselves Mediator; a player joins
 * by a link and builds a pilot in it. Each opens Play from the Play landing:
 * the Mediator's "Mediate <Game>", the player's "Play Mira Voss in <Game>".
 *
 *  1. **Propose → accept.** The Mediator taps the player's seat, which aims
 *     Propose, and proposes HP → 4; the proposal reads Pending. The player
 *     Accepts it on their Feed, and the Mediator's reads Applied — without the
 *     Mediator ever writing the sheet (ADR-030 §4).
 *  2. **Begin Downtime → a step → Advance.** Begin Downtime puts the table on
 *     step 1, and the player's screen follows into Downtime, locked for them.
 *     The player applies the step (or marks it done where it applies nothing),
 *     the Mediator sees them done, Advances, and the player's screen moves on.
 *     Back brings it back; Scene ends it.
 *
 * Along the way both screens are held to the layout law at every Play
 * viewport (the page never scrolls) and scanned with axe in each state: the
 * Mediator's Scene and Downtime, the player's On foot and Downtime in a Game.
 *
 * Two accounts, so it SKIPS without the test sign-in seam (`fixtures.ts`); it
 * runs for real in ci.yml's `build-web`, on every PR, and in the nightly `e2e`
 * job.
 */

const GAME = 'The Rust Belt Run'

/** The player's seat on the Mediator's table: a radio named "<callsign or name>, here, …". */
function seat(page: Page) {
  return page.getByRole('radio', { name: /^(Sparks|Mira Voss), / })
}

test('the Mediator runs the table from Play, and the player answers', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(10 * 60_000)
  const a11y: string[] = []
  await createGame(page, GAME)
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await expect(page.getByText('You mediate')).toBeVisible({ timeout: 15_000 })
  const token = await makeInviteLink(page)

  const player = await secondAccount(browser, info)
  try {
    await gotoStable(player.page, `/invite/${token}`)
    await waitForReady(player.page)
    await player.page.getByRole('button', { name: 'Join this Game' }).click()
    await player.page.waitForURL(/\/play\/games\/[^/]+$/, { timeout: 20_000 })
    // Joining lands on the Game's page in Play; its Create Pilot builds into it.
    const gameId = new URL(player.page.url()).pathname.split('/').pop()
    await buildPilot(player.page, 'Mira Voss', 'Sparks', gameId)

    // --- Both screens, from the Play landing ---
    const playerPath = await playDoor(player.page, `Play Mira Voss in ${GAME}`)
    await openPlay(player.page, playerPath)
    await expect(situation(player.page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expectNoPageScroll(player.page, 'player in a Game, On foot')
    a11y.push(...(await axeViolations(player.page, 'player in a Game, On foot')))

    const mediatorPath = await playDoor(page, `Mediate ${GAME}`)
    await openPlay(page, mediatorPath)
    const bar = page.locator('.su-dash-root header')
    await expect(bar.getByRole('heading', { name: GAME })).toBeVisible()
    await expect(bar.getByText('Mediator', { exact: true })).toBeVisible()
    await expect(seat(page)).toBeVisible({ timeout: 30_000 })
    await expectNoPageScroll(page, 'Mediator, Scene')
    a11y.push(...(await axeViolations(page, 'Mediator, Scene')))

    // --- 1. Propose → accept ---
    await seat(page).click()
    await expect(seat(page)).toHaveAttribute('aria-checked', 'true')
    await page.getByLabel('To', { exact: true }).fill('4')
    await page.getByLabel('Reason (optional)').fill('Rifle Squad volley')
    await page.getByRole('button', { name: 'Propose', exact: true }).click()
    const newest = page.getByRole('region', { name: 'Newest proposals' })
    await expect(newest.getByText(/HP → 4/)).toBeVisible({ timeout: 15_000 })
    await expect(newest.getByText('Pending', { exact: true })).toBeVisible()

    const accept = player.page.getByRole('button', { name: /^Accept: Mediator proposes .*HP → 4/ })
    await expect(accept).toBeVisible({ timeout: 20_000 })
    await expect(player.page.getByText('“Rifle Squad volley”')).toBeVisible()
    await accept.click()
    await expect(accept).toHaveCount(0, { timeout: 15_000 })
    await expect(newest.getByText('Applied', { exact: true })).toBeVisible({ timeout: 20_000 })

    // --- 2. Begin Downtime → the player applies a step → Advance ---
    await gameState(page).getByRole('button', { name: 'Begin Downtime' }).click()
    await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 1' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('heading', { name: /^Downtime · Step 1 of \d+$/ })).toBeVisible()

    // The player's screen follows the table, and the Downtime is not theirs to end.
    await expect(
      situation(player.page).getByRole('button', { name: 'Downtime, set by the Mediator' })
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
    await expect(
      player.page.getByRole('heading', { name: /^Downtime · Step 1 of \d+$/ })
    ).toBeVisible()
    await expectNoPageScroll(player.page, 'player in a Game, Downtime')
    a11y.push(...(await axeViolations(player.page, 'player in a Game, Downtime')))
    await expectNoPageScroll(page, 'Mediator, Downtime')
    a11y.push(...(await axeViolations(page, 'Mediator, Downtime')))

    // The step box: the innermost region carrying its stamp (the Actions
    // column around it carries the text too).
    const step = player.page
      .getByRole('region')
      .filter({ hasText: /Mediator advances · \d+ of \d+ done/ })
      .last()
    await step.getByRole('button', { name: /^(Apply & mark done|Mark done)$/ }).click()
    await expect(step.getByText('Done ✓')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/^1 of \d+ done$/)).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('list', { name: 'Who is done' }).getByText('Done', { exact: true })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Advance ›' }).click()
    await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 2' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      player.page.getByRole('heading', { name: /^Downtime · Step 2 of \d+$/ })
    ).toBeVisible({ timeout: 20_000 })

    // Back brings the table back; Scene ends it, behind its confirm.
    await page.getByRole('button', { name: 'Back to Step 1' }).click()
    await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 1' })).toBeVisible()
    await gameState(page).getByRole('button', { name: 'Scene' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'End Downtime' }).click()
    await expect(gameState(page).getByRole('button', { name: 'Begin Downtime' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(situation(player.page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 20_000 }
    )
  } finally {
    await player.context.close()
  }
  expect(a11y, 'accessibility violations on the Play screens').toEqual([])
})
