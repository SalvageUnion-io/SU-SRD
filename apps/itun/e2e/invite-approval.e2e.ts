import { gotoStable, waitForReady } from './_helpers'
import { createGame, makeInviteLink, secondAccount } from './_table'
import { expect, test } from './fixtures'

/**
 * An approval link, used, and the Organizer lets the person in (issue 1278, board
 * M2; docs/architecture/mediator-dashboard.md §3, P8a gate 2).
 *
 * The Organizer makes a link with "I approve each person who uses it" ticked.
 * A second account opens it and asks to join, and is told they wait. The
 * Organizer sees them under Asking to join and presses Let in; the second
 * account's Game page then loads, because a pending request is not a
 * membership and Let in is what seats them (`invites.decideRequest`).
 *
 * Two accounts, so it SKIPS without the test sign-in seam and runs for real in
 * the nightly `e2e-itun` job (`fixtures.ts`).
 */

test('an approval link is used, and the Organizer lets the person in', async ({
  page,
  browser,
}, info) => {
  test.slow()
  const gameId = await createGame(page, 'Tenacity Run')
  const token = await makeInviteLink(page, { approval: true })
  await expect(
    page.getByRole('list', { name: 'Open invite links' }).getByText(/You approve each/)
  ).toBeVisible()

  const guest = await secondAccount(browser, info)
  try {
    // --- They knock ---
    await gotoStable(guest.page, `/invite/${token}`)
    await waitForReady(guest.page)
    await guest.page.getByRole('button', { name: 'Ask to join' }).click()
    await expect(guest.page.getByText(/Asked to join Tenacity Run/)).toBeVisible({
      timeout: 15_000,
    })

    // --- The Organizer lets them in ---
    const asking = page.getByRole('list', { name: 'Asking to join' })
    await expect(asking.getByText('Player seat link', { exact: false })).toBeVisible({
      timeout: 20_000,
    })
    await asking.getByRole('button', { name: /^Let .+ in$/ }).click()
    await expect(page.getByText(/Nobody is waiting/)).toBeVisible({ timeout: 15_000 })

    // --- Their Game page loads ---
    await gotoStable(guest.page, `/games/${gameId}`)
    await waitForReady(guest.page)
    await expect(guest.page.getByRole('heading', { level: 2, name: 'Tenacity Run' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(guest.page.getByRole('heading', { level: 2, name: 'Crew & seats' })).toBeVisible()
  } finally {
    await guest.context.close()
  }
})
