import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import { findRelationFindings } from './_relationChips'
import { test } from './fixtures'

/**
 * Hard rule R5, a linked unit is a relation chip (C11), over every context
 * (hard rule R0's `designRoutes`), seeded, at page and phone widths, Play's
 * phone form tab by tab (`_relationChips.ts`): no entity in a Row's body and
 * no Token hung under a Row. Its copy half is the `copy` gate's banned role
 * stamps ("Assigned Mech", "Assigned Pilot").
 *
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule, each to be fixed and deleted here.
 */
const BASELINE: readonly DesignDebt[] = []

test('every linked unit is a relation chip, never an entity under a Row', async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ where }) => {
    const lines = new Map<string, string>()
    for (const f of await findRelationFindings(page)) lines.set(`${where}: ${f.detail}`, f.rule)
    return [...lines].map(([line, rule]) => ({ rule, line }))
  })
  expectWithinBaseline('relation-chips', findings, BASELINE)
})
