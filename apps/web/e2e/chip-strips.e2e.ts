import { expect, test } from '@playwright/test'
import { findChipStripFaults } from './_chipStrips'
import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { holdPending, ruleOfFault } from './_pendingRules'

/**
 * The chip-strip law (ruleset §4.7) on the signed-out reference corpus
 * (`REFERENCE_CORPUS`, `_designTable.ts`): a Page's band cluster, its cards'
 * heads, their Minis. A failure names the page, the width and the fault
 * (`_chipStrips.ts`): a value off its label's size, a hole between chips,
 * lines on no common edge, a cost out of its corner, a chip clipped or past
 * its strip's edge (R3), too many lines, and R37's: a head its chips make
 * taller, a chip above its name, an overflow row that is not its body's
 * first, +MORE on a contentful head. There is no allowlist: every fault
 * fails, bar a pending rule's (`_pendingRules.ts`: a name off its head's
 * left), which the report shows.
 *
 * Every signed-in context (`designRoutes`) is `design-walk.e2e.ts`'s.
 *
 * Widths: R0's page and phone, a mid desktop (1024: a class page's Training
 * cards three across beside the art), and a narrow band (680: chips beside
 * the title in rows).
 */
test.describe.configure({ retries: 0 })

test('every chip strip is one size, one gap, its cost in the corner', async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const found = await walkDesignRoutes(
    page,
    async ({ where }) =>
      (await findChipStripFaults(page)).map((fault) => ({
        rule: ruleOfFault(fault),
        line: `${where}, ${fault}`,
      })),
    { routes: corpusRoutes(), widths: ['page', 1024, 680, 'phone'] }
  )
  const failures = holdPending('chip-strips', found).map((f) => f.line)
  expect(failures, 'chip strips off the §4.7 law').toEqual([])
})
