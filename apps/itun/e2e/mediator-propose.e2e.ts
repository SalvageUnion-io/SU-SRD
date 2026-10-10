import { buildPilot, gotoStable, waitForReady } from './_helpers'
import { createGame, makeInviteLink, secondAccount } from './_table'
import { expect, test } from './fixtures'

/**
 * The Mediator proposes; the player decides (issue 1278, boards M1 and M2;
 * docs/architecture/mediator-dashboard.md §3, P8a gate 1).
 *
 * The Organizer makes a Game and appoints themselves Mediator; a player joins
 * by a link and builds a pilot in it. From the Mediator Dashboard the Mediator
 * taps the player's seat, proposes HP → 4 with a reason, and the row reads
 * Pending. The player applies it from the Game page, and the Mediator's row
 * reads Applied and the seat card's HP reads 4 — without the Mediator ever
 * writing the sheet (ADR-030 §4).
 *
 * Two accounts, so it SKIPS without the test sign-in seam and runs for real in
 * the nightly `e2e-itun` job (`fixtures.ts`).
 */

test('a Mediator proposes a change and the player applies it', async ({ page, browser }, info) => {
  test.slow()
  const gameId = await createGame(page, 'Reclamation of the Wastes')

  // The Organizer appoints the Mediator: here, themselves.
  await page.getByRole('button', { name: 'Appoint' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Appoint' }).click()
  await expect(page.getByText('You mediate')).toBeVisible({ timeout: 15_000 })

  const token = await makeInviteLink(page, { approval: false })

  const player = await secondAccount(browser, info)
  try {
    // --- The player joins and builds a pilot in the Game ---
    await gotoStable(player.page, `/invite/${token}`)
    await waitForReady(player.page)
    await player.page.getByRole('button', { name: 'Join this game' }).click()
    await player.page.waitForURL(new RegExp(`/games/${gameId}$`), { timeout: 20_000 })
    await buildPilot(player.page, 'Mira Voss', 'Sparks')

    // --- The Mediator proposes from the dashboard ---
    await page.getByRole('link', { name: 'Open the Mediator dashboard' }).click()
    await page.waitForURL(new RegExp(`/mediator/${gameId}$`))
    const seat = page.getByRole('button', { name: /^Sparks, HP / })
    await expect(seat).toBeVisible({ timeout: 30_000 })
    await seat.click()
    await expect(page.getByLabel('Target')).toHaveValue(/.+/)
    await page.getByLabel('To').fill('4')
    await page.getByLabel('Reason (optional)').fill('Rifle Squad volley')
    await page.getByRole('button', { name: 'Propose' }).click()

    const newest = page.getByRole('region', { name: 'Newest proposals' })
    await expect(newest.getByText('Sparks · HP → 4 · “Rifle Squad volley”')).toBeVisible({
      timeout: 15_000,
    })
    await expect(newest.getByText('Pending')).toBeVisible()

    // --- The player answers on the Game page ---
    await gotoStable(player.page, `/games/${gameId}`)
    await waitForReady(player.page)
    await expect(player.page.getByText('“Rifle Squad volley”')).toBeVisible({ timeout: 20_000 })
    await player.page.getByRole('button', { name: /^Apply Sparks · HP → 4/ }).click()
    await expect(player.page.getByRole('button', { name: /^Apply Sparks/ })).toHaveCount(0, {
      timeout: 15_000,
    })

    // --- The Mediator's screen follows, live ---
    await expect(newest.getByText('Applied')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /^Sparks, HP 4 of / })).toBeVisible()
  } finally {
    await player.context.close()
  }
})
