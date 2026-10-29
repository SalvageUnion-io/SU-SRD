import { findChipStrips } from './_chipStrips'
import { expectCorpusClean } from './_designRoutes'
import { test } from './fixtures'

/**
 * The chip-strip law (ruleset §4.7) on the signed-out reference corpus
 * (`REFERENCE_CORPUS`, `_designTable.ts`): a Page's band cluster, its cards'
 * heads, their Minis. A failure names the page, the width and the fault
 * (`_chipStrips.ts`): a value off its label's size, a hole between chips,
 * lines on no common edge, a cost out of its corner, a chip clipped or past
 * its strip's edge (R3), too many lines, and R37's: a head its chips make
 * taller, a chip above its name, an overflow row that is not its body's
 * first, +MORE on a contentful head, a name off its head's left (R40). There
 * is no allowlist: every fault fails, bar a pending rule's
 * (`_pendingRules.ts`), which the report shows.
 *
 * Every signed-in context (`designRoutes`) is `design-walk.e2e.ts`'s.
 *
 * Widths: R0's page and phone, a mid desktop (1024: a class page's Training
 * cards three across beside the art), and a narrow band (680: chips beside
 * the title in rows).
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every chip strip is one size, one gap, its cost in the corner', { tag: '@pr' }, async ({
  page,
}) => {
  test.setTimeout(20 * 60_000)
  await expectCorpusClean(page, 'chip-strips', () => findChipStrips(page), {
    widths: ['page', 1024, 680, 'phone'],
    message: 'chip strips off the §4.7 law',
  })
})
