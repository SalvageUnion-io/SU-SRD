import { gotoStable, waitForReady } from './_helpers'
import { createGame, makeInviteLink, secondAccount } from './_table'
import { expect, test } from './fixtures'

/**
 * A Game from end to end, every step in Play but the Hangar the pilot comes
 * from (ADR-052 §3–§5):
 *
 *  1. The Organizer makes a Game on the Play hub (+ New Game) and lands on its
 *     page, `/play/games/<id>`, and copies its invite link.
 *  2. A player, with a pilot already in their Hangar, opens the link and joins:
 *     joining lands on the same Game's page.
 *  3. They move the pilot in from their Hangar (the page's single-choice
 *     picker), and the roster lists it.
 *  4. Play opens that pilot's Cockpit.
 *
 * Two accounts, so it SKIPS without the test sign-in seam (`fixtures.ts`); it
 * runs for real in ci.yml's `build-web`, on every PR, and in the nightly `e2e`
 * job.
 */

const GAME = 'The Glass Road'
const PILOT = 'Bonesaw'

test('a Game made in Play: invite, join, a pilot moved in from the Hangar, then Play', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(5 * 60_000)

  // --- 1. Create, in Play ---
  const gameId = await createGame(page, GAME)
  const token = await makeInviteLink(page)

  const player = await secondAccount(browser, info)
  try {
    // A pilot in the player's Hangar: Bonesaw, copied from the Starter Set.
    await gotoStable(player.page, `/starter/pilot/starter-pilot-${PILOT.toLowerCase()}`)
    await waitForReady(player.page)
    await player.page.getByRole('button', { name: 'Make a copy', exact: true }).first().click()
    await player.page.getByRole('alertdialog').getByRole('button', { name: 'Make a copy' }).click()
    await expect(
      player.page.getByText(new RegExp(`^Copied .*${PILOT}.* to your Hangar`)).first()
    ).toBeVisible({ timeout: 20_000 })

    // --- 2. Invite → join: joining lands on the Game's page in Play ---
    await gotoStable(player.page, `/invite/${token}`)
    await waitForReady(player.page)
    await player.page.getByRole('button', { name: 'Join this Game' }).click()
    await player.page.waitForURL(new RegExp(`/play/games/${gameId}$`), { timeout: 20_000 })
    await expect(player.page.getByRole('heading', { level: 1, name: GAME })).toBeVisible({
      timeout: 20_000,
    })

    // --- 3. Move the pilot in from the Hangar: one choice, one move ---
    await player.page.getByRole('button', { name: '+ Move in from your Hangar' }).click()
    const picker = player.page.getByRole('dialog', { name: 'Move in from your Hangar' })
    await picker.getByRole('radio', { name: PILOT }).click()
    await picker.getByRole('button', { name: `Move ${PILOT} in` }).click()
    await expect(player.page.getByText(`Moved ${PILOT} to ${GAME}.`).first()).toBeVisible({
      timeout: 20_000,
    })
    await expect(picker).toBeHidden()
    await expect(
      player.page.getByRole('region', { name: 'Pilots' }).getByText(PILOT).first()
    ).toBeVisible({ timeout: 20_000 })

    // --- 4. Play: the pilot's Cockpit ---
    await player.page.getByRole('button', { name: 'Play', exact: true }).first().click()
    const launch = player.page.getByRole('dialog', { name: 'Play' })
    await expect(launch.getByRole('radio', { name: PILOT })).toBeVisible({ timeout: 20_000 })
    await launch.getByRole('button', { name: 'Play', exact: true }).click()
    await player.page.waitForURL(/\/play\/(?!games\/)[^/]+$/, { timeout: 20_000 })
    await expect(player.page.locator('.su-dash-root header h1')).toBeVisible({ timeout: 30_000 })
  } finally {
    await player.context.close()
  }
})
