import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { board, CANVAS, openPlay, PHONE, playDoor } from './_play'
import { findSiblingMismatches } from './_siblingHeights'
import { setUpTable } from './_table'
import { test as signedIn } from './fixtures'

/**
 * The sibling-height law (ruleset §4.7) on one of each page shape, at desktop
 * and as a phone: no line of controls whose heights differ. A failure names the
 * page, the line and every control on it with its height; give the odd one the
 * line's Size (`styles/sizing.ts`), never a height of its own.
 */
const PAGES = [
  '/',
  '/chassis/',
  '/chassis/mazona/',
  '/chassis/mazona/pattern/buzzard/',
  '/systems/',
  '/systems/salvaging-drill/',
  '/abilities/',
  '/classes/hacker/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/vehicles/fighting-box-wheel/',
  '/crawler-bays/armoury/',
  '/roll-tables/core-mechanic/',
  '/roll-tables/mechapult/',
  '/guides/create-a-pilot/',
  '/search?q=drill',
  '/build/',
  '/build/starter',
  '/build/starter/pilot/starter-pilot-bonesaw',
  '/build/starter/mech/starter-mech-mazona',
  '/build/starter/crawler/starter-crawler-tenacity',
  '/build/play/',
]

/** Desktop, and a phone's width (the phone project runs only the smoke specs). */
const WIDTHS = [1440, 390]

test.describe.configure({ retries: 0 })

test('siblings on one line share one height', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      for (const m of await findSiblingMismatches(page)) {
        const controls = m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')
        failures.push(`${path} at ${width}px, ${m.line}: ${controls}`)
      }
    }
  }
  expect(failures, 'controls on one line at different heights').toEqual([])
})

/**
 * Play's own lines: the Play bar, each unit box and each action row, open and
 * closed. On the canvas a unit box is scanned whole (its head and every body
 * row: the vitals, the pilot's class / TP / injuries beside Sheet ⤢, the
 * mech's range); on a phone only its head, since the touch floor lifts every
 * button there to 44px beside chips that keep their drawn Size. Play needs an account,
 * so this signs in, sets up the Starter Set table (`setUpTable`) and opens
 * Bonesaw's screen, on foot, then Boarded with an action open, at the
 * canvas's design size (scale 1, so a measured px is a drawn px) and as a
 * phone. Only those lines are scanned (`EXPECTED`); the rest of the page is
 * the other specs'.
 *
 * Each line's selector must match something visible where it is expected, or
 * the scan would pass having measured nothing: a renamed class fails here
 * instead of turning the gate off.
 *
 * Skips without the test sign-in seam (`fixtures.ts`): it runs nightly.
 */
const BAR = '.su-dash-root header'
const UNITS = '.su-play-unit'
const UNIT_HEADS = '.su-play-unit .su-entity-row__head'
const ACTIONS = 'li.su-play-act'

/** Which lines each view shows and scans: the canvas all three, a phone's tab its own. */
const EXPECTED: Record<string, readonly string[]> = {
  canvas: [BAR, UNITS, ACTIONS],
  Act: [BAR, ACTIONS],
  Units: [BAR, UNIT_HEADS],
}

async function playMismatches(page: Page, state: string): Promise<string[]> {
  const failures: string[] = []
  for (const viewport of [CANVAS, PHONE]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    // The phone form puts the Units on their own tab.
    for (const tab of viewport === PHONE ? ['Act', 'Units'] : [null]) {
      if (tab !== null) await page.getByRole('tab', { name: tab }).click()
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const where = tab === null ? viewport.name : `${viewport.name}, ${tab}`
      const lines = EXPECTED[tab ?? 'canvas'] ?? []
      for (const selector of lines) {
        const seen = await page.locator(selector).filter({ visible: true }).count()
        expect(seen, `Play, ${state}, at ${where}: nothing matches ${selector}`).toBeGreaterThan(0)
      }
      // The phone's other tab is hidden, so its lines measure nothing there.
      const scanned = viewport === PHONE ? [BAR, UNIT_HEADS, ACTIONS] : lines
      for (const m of await findSiblingMismatches(page, scanned.join(', '))) {
        const controls = m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')
        failures.push(`Play, ${state}, at ${where}, ${m.line}: ${controls}`)
      }
    }
    if (viewport === PHONE) await page.getByRole('tab', { name: 'Act' }).click()
  }
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  return failures
}

signedIn('Play: the bar, unit boxes and action rows share one height', async ({ page }) => {
  signedIn.setTimeout(8 * 60_000)
  const { gameName } = await setUpTable(page)
  await page.setViewportSize({ width: CANVAS.width, height: CANVAS.height })
  await openPlay(page, await playDoor(page, `Play Bonesaw in ${gameName}`))
  const failures = await playMismatches(page, 'On foot')

  await board(page, 'Scrapper')
  const use = page
    .getByRole('list', { name: 'On hand' })
    .getByRole('button', { name: /^Use / })
    .first()
  await use.click()
  await expect(page.locator('li.su-play-act[data-open]')).toHaveCount(1)
  failures.push(...(await playMismatches(page, 'Boarded, an action open')))

  expect(failures, 'Play controls on one line at different heights').toEqual([])
})
