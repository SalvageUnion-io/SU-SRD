import { expect, test } from '@playwright/test'
import { findChipStripFaults } from './_chipStrips'

/**
 * The chip-strip law (ruleset §4.7) on the page shapes that carry chips: a
 * Page's band cluster, its cards' heads, their Tokens. A failure names the
 * page, the width and the fault (`_chipStrips.ts`): a value off its label's
 * size, a hole between chips, lines on no common edge, a cost out of its
 * corner. There is no allowlist: every fault fails.
 */
const PAGES = [
  '/systems/',
  '/modules/',
  '/chassis/mazona/',
  '/chassis/mazona/pattern/buzzard/',
  '/chassis/mule/pattern/crusher/',
  '/systems/salvaging-drill/',
  '/systems/50-cal-machine-gun/',
  '/modules/survey-scanner/',
  '/abilities/',
  '/classes/hacker/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/vehicles/fighting-box-wheel/',
  '/crawler-bays/armoury/',
  '/search?q=drill',
]

/** A wide page, a narrow band (chips beside the title in rows), a phone. */
const WIDTHS = [1440, 680, 390]

test.describe.configure({ retries: 0 })

test('every chip strip is one size, one gap, its cost in the corner', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      for (const fault of await findChipStripFaults(page)) {
        failures.push(`${path} at ${width}px, ${fault}`)
      }
    }
  }
  expect(failures, 'chip strips off the §4.7 law').toEqual([])
})
