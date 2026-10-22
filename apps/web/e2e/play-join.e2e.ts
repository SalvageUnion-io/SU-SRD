import { openApp } from './_helpers'
import { copyStarter, createGame, joinByInvite, makeInviteLink, secondAccount } from './_table'
import { moveToGame } from './_trainingBay'
import { expect, test } from './fixtures'

/**
 * A Game from end to end: made, joined and played in Play, the pilot brought
 * in from Build (ADR-052 §3–§5; Play only plays):
 *
 *  1. The Organizer makes a Game on the Play hub (+ New Game) and lands on its
 *     page, `/play/games/<id>`, and copies its invite link.
 *  2. A player, with a pilot already in their Training Bay, opens the link and joins:
 *     joining lands on the same Game's page.
 *  3. They move the pilot in from their Training Bay (its ⋯ menu's Move to a
 *     Game…, which the Game page's Manage in Build leads to), and the Game's
 *     Crew lists it.
 *  4. Play opens that pilot's Cockpit.
 *
 * Two accounts, so it SKIPS without the test sign-in seam (`fixtures.ts`); it
 * runs for real in ci.yml's `build-web`, on every PR, and in the nightly `e2e`
 * job.
 */

const GAME = 'The Glass Road'
const PILOT = 'Bonesaw'

test(
  'a Game made in Play: invite, join, a pilot moved in from Build, then Play',
  { tag: '@pr' },
  async ({ page, browser }, info) => {
    test.setTimeout(5 * 60_000)

    // --- 1. Create, in Play ---
    const gameId = await createGame(page, GAME)
    const token = await makeInviteLink(page)

    const player = await secondAccount(browser, info)
    try {
      // A pilot in the player's Training Bay: Bonesaw, copied from the Starter Set.
      await copyStarter(player.page, `pilot/starter-pilot-${PILOT.toLowerCase()}`, PILOT)

      // --- 2. Invite → join: joining lands on the Game's page in Play ---
      expect(await joinByInvite(player.page, token)).toBe(gameId)
      await expect(player.page.getByRole('heading', { level: 1, name: GAME })).toBeVisible({
        timeout: 20_000,
      })

      // --- 3. Move the pilot in from the Training Bay, in Build ---
      await player.page.getByRole('link', { name: 'Manage in Build' }).click()
      await expect(
        player.page.getByRole('heading', { level: 1, name: 'Training Bay' })
      ).toBeVisible({
        timeout: 20_000,
      })
      await moveToGame(player.page, PILOT, GAME)
      await expect(player.page.getByText(`Moved ${PILOT} to ${GAME}.`).first()).toBeVisible({
        timeout: 20_000,
      })
      await openApp(player.page, `/play/games/${gameId}`)
      await expect(
        player.page.getByRole('region', { name: 'Crew' }).getByText(PILOT).first()
      ).toBeVisible({ timeout: 20_000 })

      // --- 4. Play: the pilot's Cockpit ---
      await player.page.getByRole('button', { name: 'Play', exact: true }).first().click()
      const launch = player.page.getByRole('dialog', { name: 'Play' })
      await expect(launch.getByRole('radio', { name: PILOT })).toBeVisible({ timeout: 20_000 })
      await launch.getByRole('button', { name: 'Play', exact: true }).click()
      await player.page.waitForURL(/\/play\/(?!games\/)[^/]+$/, { timeout: 20_000 })
      await expect(player.page.locator('.su-play-root header h1')).toBeVisible({ timeout: 30_000 })
    } finally {
      await player.context.close()
    }
  }
)
