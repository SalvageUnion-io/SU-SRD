import { expect, test } from '@playwright/test'
import { findChipStripFaults } from './_chipStrips'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt } from './_designTable'
import { holdPending, ruleOfFault } from './_pendingRules'
import { test as signedIn } from './fixtures'

/**
 * The chip-strip law (ruleset §4.7) on the page shapes that carry chips: a
 * Page's band cluster, its cards' heads, their Minis. A failure names the
 * page, the width and the fault (`_chipStrips.ts`): a value off its label's
 * size, a hole between chips, lines on no common edge, a cost out of its
 * corner, a chip clipped or past its strip's edge (R3), too many lines, and
 * R37's: a head its chips make taller, a chip above its name, an overflow
 * row that is not its body's first, +MORE on a contentful head.
 * There is no allowlist: every fault fails, bar a pending rule's
 * (`_pendingRules.ts`: a name off its head's left), which the report shows.
 */
const PAGES = [
  '/systems/',
  '/modules/',
  '/chassis/mazona/',
  '/chassis/big-brother/',
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
  '/creatures/',
  '/creatures/irradiated-scorpion/',
  '/abilities/mass-field-maintenance/',
]

/**
 * A wide page, a mid desktop (1024: a class page's Training cards three
 * across beside the art), a narrow band (chips beside the title in rows), a
 * phone.
 */
const WIDTHS = [1440, 1024, 680, 390]

test.describe.configure({ retries: 0 })

test('every chip strip is one size, one gap, its cost in the corner', async ({ page }) => {
  test.setTimeout(10 * 60_000)
  const found: { rule: string; line: string }[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      for (const fault of [...(await findChipStripFaults(page))]) {
        found.push({ rule: ruleOfFault(fault), line: `${path} at ${width}px, ${fault}` })
      }
    }
  }
  const failures = holdPending('chip-strips', found).map((f) => f.line)
  expect(failures, 'chip strips off the §4.7 law').toEqual([])
})

/**
 * Every context (hard rule R0): each of `designRoutes` (`_designTable.ts`),
 * signed in and seeded, at page and phone widths, Play's phone form tab by
 * tab. A fault's rule is its kind: `size`, `gap`, `flush`, `cost`, `clip`
 * or `lines`. The seeded Game's long name holds a Training Bay Compact's Game chip
 * inside its Compact at a page's three columns (R3).
 *
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule, each to be fixed and deleted here. A fault off it fails; an entry
 * nothing matches is noted on the report as paid off.
 */
const BASELINE: readonly DesignDebt[] = [
  {
    family: 'sheet-crawler-edit',
    rule: 'flush',
    match: 'flush: Wasteland Explorer',
    why: "the crawler's type strip wraps in Edit with its lines on no common edge",
  },
]

signedIn('every context: every chip strip is one size, one gap', async ({ page }) => {
  signedIn.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ where }) =>
    (await findChipStripFaults(page)).map((fault) => ({
      rule: ruleOfFault(fault),
      line: `${where}, ${fault}`,
    }))
  )
  expectWithinBaseline('chip-strips', findings, BASELINE)
})
