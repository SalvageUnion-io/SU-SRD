import type { Page } from '@playwright/test'
import { buildPilot, openApp } from './_helpers'
import {
  axeViolations,
  expectNoPageScroll,
  gameState,
  openPlay,
  playDoor,
  situation,
} from './_play'
import { createGame, joinByInvite, makeInviteLink, secondAccount } from './_table'
import { expect, test } from './fixtures'

/**
 * The Mediator runs the table from Play, and the player answers from theirs
 * (play.md §8, §10).
 *
 * The Organizer makes a Game and appoints themselves Mediator; a player joins
 * by a link and builds a pilot in it. Each opens Play from the Play landing:
 * the Mediator's "Start a group session of <Game>", the player's "Open table as Sparks in <Game>", the door naming its pilot by callsign.
 *
 *  1. **Propose → accept.** The Mediator taps the player's seat, which aims
 *     Propose, and proposes HP → 4; the proposal reads Pending. The player
 *     Accepts it on their Feed, and the Mediator's reads Applied — without the
 *     Mediator ever writing the sheet (ADR-030 §4).
 *  2. **Begin Downtime → a step → it moves on.** Begin Downtime puts the
 *     table on step 1, and the player's screen follows into Downtime, locked
 *     for them; steps nobody can act in, and one every seat finished, pass
 *     by themselves (r7 D3), and Back holds the step it lands on.
 *     The player applies the step (or marks it done where it applies nothing)
 *     and both screens move on. Scene ends it.
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

/**
 * The player's seat on the Mediator's table: its toggle Mini's name, a button
 * named by what it shows, "<callsign · name> (Pilot), here, …" (aboard, its
 * Mech's first), pressed while Propose is aimed there.
 */
function seat(page: Page) {
  return page.getByRole('list', { name: 'Seats' }).getByRole('button', {
    name: /^(?:.+ \(Mech\), )?Sparks · Mira Voss(?: \(Pilot\))?, /,
  })
}

test(
  'the Mediator runs the table from Play, and the player answers',
  { tag: '@pr' },
  async ({ page, browser }, info) => {
    test.setTimeout(10 * 60_000)
    const a11y: string[] = []
    await createGame(page, GAME)
    // The creator said Yes to "Will you be the Mediator?", the dialog's given answer.
    await expect(page.getByRole('link', { name: 'Mediate' })).toBeVisible({ timeout: 15_000 })
    const token = await makeInviteLink(page)

    const player = await secondAccount(browser, info)
    try {
      // Joining lands on the Game's page in Play; its Create Pilot builds into it.
      const gameId = await joinByInvite(player.page, token)
      await buildPilot(player.page, 'Mira Voss', 'Sparks', gameId)

      // --- Both screens, from the Play landing ---
      const playerPath = await playDoor(player.page, `Open table as Sparks in ${GAME}`)
      await openPlay(player.page, playerPath)
      await expect(situation(player.page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await expectNoPageScroll(player.page, 'player in a Game, On foot')
      a11y.push(...(await axeViolations(player.page, 'player in a Game, On foot')))

      // The Mediator starts the group session from the hub, which opens their screen.
      await openApp(page, '/games/')
      await page.getByRole('button', { name: `Start a group session of ${GAME}` }).click()
      await page.waitForURL(/\/mediate$/, { timeout: 30_000 })
      await openPlay(page, new URL(page.url()).pathname)
      const bar = page.locator('.su-play-root header')
      await expect(bar.getByRole('heading', { name: GAME })).toBeVisible()
      await expect(bar.getByText('Mediator', { exact: true })).toBeVisible()
      await expect(seat(page)).toBeVisible({ timeout: 30_000 })
      await expectNoPageScroll(page, 'Mediator, Scene')
      a11y.push(...(await axeViolations(page, 'Mediator, Scene')))

      // --- 1. Propose → accept ---
      await seat(page).click()
      await expect(seat(page)).toHaveAttribute('aria-pressed', 'true')
      // Propose opens on Take (r4 D2): this one names the value itself.
      await page.getByLabel('Change', { exact: true }).selectOption('set')
      await page.getByLabel('To', { exact: true }).fill('4')
      await page.getByLabel('Reason (optional)').fill('Rifle Squad volley')
      await page.getByRole('button', { name: 'Propose', exact: true }).click()
      const newest = page.getByRole('region', { name: 'Newest proposals' })
      await expect(newest.getByText(/HP → 4/)).toBeVisible({ timeout: 15_000 })
      await expect(newest.getByText('Pending', { exact: true })).toBeVisible()

      const accept = player.page.getByRole('button', {
        // From what the sheet holds to what is asked (r2 C7).
        name: /^Accept: Mediator proposes .*HP \d+ → 4/,
      })
      await expect(accept).toBeVisible({ timeout: 20_000 })
      // The reason reads on the Feed's own line; the notice over the bar says it too.
      await expect(
        player.page.getByRole('region', { name: 'Feed' }).getByText('“Rifle Squad volley”')
      ).toBeVisible()
      await accept.click()
      await expect(accept).toHaveCount(0, { timeout: 15_000 })
      await expect(newest.getByText('Applied', { exact: true })).toBeVisible({ timeout: 20_000 })

      // --- 2. Begin Downtime → the player applies a step → Advance ---
      await gameState(page).getByRole('button', { name: 'Begin Downtime' }).click()
      // It moves every player's screen, so it asks first (r2 C5).
      await page
        .getByRole('alertdialog', { name: 'Begin Downtime?' })
        .getByRole('button', { name: 'Begin Downtime' })
        .click()
      // On step 1, or already past steps nobody can act in (r7 D3).
      await expect(
        gameState(page).getByRole('button', { name: /^Downtime · Step \d+$/ })
      ).toBeVisible({ timeout: 15_000 })
      await expect(
        page.getByRole('heading', { name: /^Downtime · Step \d+ of \d+$/ })
      ).toBeVisible()

      // The player's screen follows the table, and the Downtime is not theirs to end.
      await expect(
        situation(player.page).getByRole('button', { name: 'Downtime, set by the Mediator' })
      ).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 })
      await expect(
        player.page.getByRole('heading', { name: /^Downtime · Step \d+ of \d+$/ })
      ).toBeVisible()
      await expectNoPageScroll(player.page, 'player in a Game, Downtime')
      a11y.push(...(await axeViolations(player.page, 'player in a Game, Downtime')))
      await expectNoPageScroll(page, 'Mediator, Downtime')
      a11y.push(...(await axeViolations(page, 'Mediator, Downtime')))

      // Steps nobody can act in pass by themselves (r7 D3): no Scrap carried and
      // no crawler, so the table moves past Tally Salvage and Upkeep to Restore.
      await expect(page.getByRole('heading', { name: /^Downtime · Step 3 of \d+$/ })).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        player.page.getByRole('heading', { name: /^Downtime · Step 3 of \d+$/ })
      ).toBeVisible({ timeout: 20_000 })

      // The step box: the innermost region carrying its stamp (the Actions
      // column around it carries the text too).
      const step = player.page
        .getByRole('region')
        .filter({ hasText: /Mediator advances · \d+ of \d+ done/ })
        .last()
      await step.getByRole('button', { name: /^(Apply & mark done|Mark done)$/ }).click()

      // Every seat done, it moves on by itself, past Trade and Craft (no crawler), to step 6.
      await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 6' })).toBeVisible({
        timeout: 20_000,
      })
      await expect(
        page.getByText(/^Moved on by itself, nothing left to do: .*3 Restore/)
      ).toBeVisible()
      await expect(
        player.page.getByRole('heading', { name: /^Downtime · Step 6 of \d+$/ })
      ).toBeVisible({ timeout: 20_000 })

      // Back brings the table back, and the step stepped back to waits for Next;
      // Scene ends it, behind its confirm.
      await page.getByRole('button', { name: 'Back to Step 5' }).click()
      await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 5' })).toBeVisible()
      await page.getByRole('button', { name: 'Next: Step 6' }).waitFor()
      await expect(gameState(page).getByRole('button', { name: 'Downtime · Step 5' })).toBeVisible()
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
  }
)
