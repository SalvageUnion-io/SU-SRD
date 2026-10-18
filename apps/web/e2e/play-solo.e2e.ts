import { buildMech, buildPilot } from './_helpers'
import { axeViolations, board, expectNoPageScroll, openPlay, playDoor, situation } from './_play'
import { expect, test } from './fixtures'

/**
 * Solo Play (play.md §3, §6; wireframes player-solo and player-solo-downtime):
 * a pilot and a mech on the shelf, played without a Game, through each
 * Situation — On foot, Boarded, and a Downtime the player runs themselves.
 *
 * In every state the page never scrolls at the Play viewports (the canvas at
 * 1280 × 800 and at its scale floor, the phone at 390 × 844), and axe finds
 * nothing at the canvas or the phone.
 *
 * Skips without the test sign-in seam, like every signed-in spec
 * (`fixtures.ts`); the nightly `e2e` job runs it for real.
 */

test('solo: On foot, Boarded and Downtime fit and pass axe', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const a11y: string[] = []
  await buildPilot(page, 'Rook Hale', 'Rook')
  await buildMech(page, 'Ironclad')

  await openPlay(page, await playDoor(page, 'Play Rook Hale solo'))
  const bar = page.locator('.su-dash-root header')
  await expect(bar.getByRole('heading', { name: /Rook Hale/ })).toBeVisible()

  // --- On foot ---
  await expect(situation(page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expectNoPageScroll(page, 'solo, On foot')
  a11y.push(...(await axeViolations(page, 'solo, On foot')))

  // --- Boarded ---
  await board(page, 'Ironclad')
  await expect(page.getByText('On hand · In Ironclad')).toBeVisible({ timeout: 15_000 })
  await expectNoPageScroll(page, 'solo, Boarded')
  a11y.push(...(await axeViolations(page, 'solo, Boarded')))

  // --- Downtime: the player's own, run by them ---
  await situation(page).getByRole('button', { name: 'Downtime', exact: true }).click()
  await expect(page.getByRole('heading', { name: /^Downtime · Step 1 of \d+$/ })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('You run it')).toBeVisible()
  await page.getByRole('button', { name: 'Next step ›' }).click()
  await expect(page.getByRole('heading', { name: /^Downtime · Step 2 of \d+$/ })).toBeVisible({
    timeout: 15_000,
  })
  await expectNoPageScroll(page, 'solo, Downtime')
  a11y.push(...(await axeViolations(page, 'solo, Downtime')))

  // Leaving a running Downtime ends it, behind a confirm.
  await situation(page).getByRole('button', { name: 'On foot' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'End Downtime' }).click()
  await expect(situation(page).getByRole('button', { name: 'On foot' })).toHaveAttribute(
    'aria-pressed',
    'true',
    { timeout: 15_000 }
  )

  expect(a11y, 'accessibility violations on the solo Play screen').toEqual([])
})
