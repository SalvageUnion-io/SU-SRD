import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import { findValueCellFaults } from './_valueCells'
import { expect, test } from './fixtures'

/**
 * Hard rule R31, "Value cells and seams" (ruleset §7.1, §7.2), over every
 * context (R0's `designRoutes`), signed in and seeded, at page and phone
 * widths, Play's phone form tab by tab (`_valueCells.ts`): every `Stat` value
 * cell is paper with a 1px ink frame (`fill`, `frame`), and every
 * border-riding stamp centres on its frame's border line (`seam`).
 *
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule, each to be fixed and deleted here. A finding off it fails; an entry
 * nothing matches is noted on the report as paid off.
 */
const BASELINE: readonly DesignDebt[] = []

test.describe.configure({ retries: 0 })

test('every context: value cells are paper in a 1px ink frame; seam stamps centre on their line', async ({
  page,
}) => {
  test.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const read = { cells: 0, seams: 0 }
  const findings = await walkDesignRoutes(page, seed, async ({ where }) => {
    const { faults, cells, seams } = await findValueCellFaults(page)
    read.cells += cells
    read.seams += seams
    return faults.map((fault) => ({
      rule: fault.slice(0, fault.indexOf(':')),
      line: `${where}, ${fault}`,
    }))
  })
  test.info().annotations.push({
    type: 'read',
    description: `${read.cells} value cells, ${read.seams} seam stamps`,
  })
  expect(read.cells, 'the walk read value cells').toBeGreaterThan(0)
  expect(read.seams, 'the walk read seam stamps').toBeGreaterThan(0)
  expectWithinBaseline('value-cells', findings, BASELINE)
})
