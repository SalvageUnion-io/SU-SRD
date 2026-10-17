import { expect, test } from '@playwright/test'
import { findSiblingMismatches } from './_siblingHeights'

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
