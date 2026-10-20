import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt } from './_designTable'
import { findStripControlFaults } from './_stripControls'
import { test } from './fixtures'

/**
 * Hard rule R6, nothing beside or under a strip (`chips-and-actions.md` C1,
 * C8; EDL E8), over every context (hard rule R0's `designRoutes`), seeded, at
 * page and phone widths, Play's phone form tab by tab (`_stripControls.ts`):
 * every control in an entity list item is inside its entity's chip group,
 * its state, uses and actions inlined last after the cost; none sits beside
 * the strip (`beside`) or in the body under it (`under`).
 *
 * No baseline: every finding fails. A sheet item's state, uses, actions and ✕
 * ride its Mini's chip group (`SheetItemLine`, R11), its name the link.
 */
const BASELINE: readonly DesignDebt[] = []

test('every control in an entity list item is in its chip group', async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ where }) =>
    (await findStripControlFaults(page)).map((fault) => ({
      rule: fault.slice(0, fault.indexOf(':')),
      line: `${where}, ${fault}`,
    }))
  )
  expectWithinBaseline('strip-controls', findings, BASELINE)
})
