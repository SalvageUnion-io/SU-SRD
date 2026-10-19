import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
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
 * `BASELINE` is the debt by route family and rule, each to be fixed and
 * deleted here. A finding off it fails; an entry nothing matches is noted on
 * the report as paid off.
 */
const SHEET_ITEM_LINE =
  "`SheetItemLine` (`build/sheet/`) sets a sheet item's condition, uses, actions and ✕ on the line beside its Token's pill: they move into the Token's chip group (state · uses · ✕), with the Live Sheet grammar (R11)"

const BASELINE: readonly DesignDebt[] = [
  // A pilot's abilities in Edit: Mark used, and a cost's Spend.
  { family: 'sheet-pilot-edit', rule: 'beside', match: ' used" beside “', why: SHEET_ITEM_LINE },
  { family: 'sheet-pilot-edit', rule: 'beside', match: 'button "Spend ', why: SHEET_ITEM_LINE },
  // A mech's Systems and Modules in Edit: the condition, the uses stepper, ✕.
  { family: 'sheet-mech-edit', rule: 'beside', match: ' status: ', why: SHEET_ITEM_LINE },
  { family: 'sheet-mech-edit', rule: 'beside', match: ' uses" beside “', why: SHEET_ITEM_LINE },
  { family: 'sheet-mech-edit', rule: 'beside', match: 'button "Remove ', why: SHEET_ITEM_LINE },
]

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
