import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import type { DesignDebt } from './_designTable'
import { chassisAbilityNames, findFormFindings } from './_formFits'
import { test } from './fixtures'

/**
 * Hard rule R35, the form fits the place (EDL E2, E11, E19), over every
 * context (hard rule R0's `designRoutes`), seeded, at page and phone widths,
 * Play's phone form tab by tab (`_formFits.ts`): every list item that holds an
 * entity draws it as a Row, a Tile or a Token; a lead only on an SRD index; a
 * chassis ability at level 1 only on its chassis and pattern Pages and the
 * mech sheet's hero, else a contentful Token.
 *
 * `BASELINE` is the debt this pass found when it landed, by route family and
 * rule, each to be fixed and deleted here. A finding off it fails; an entry
 * nothing matches is noted on the report as paid off.
 */
const BASELINE: readonly DesignDebt[] = []

test('every context draws the form its place takes', async ({ page }) => {
  test.setTimeout(20 * 60_000)
  const abilities = chassisAbilityNames()
  const seed = await seedDesignAccount(page)
  const findings = await walkDesignRoutes(page, seed, async ({ family, where }) => {
    const place = {
      // A Peek opens over an index (`designRoutes`), whose Tiles keep their leads.
      index: family === 'reference-index' || family === 'peek',
      chassisPage: family === 'reference-page' && /\/chassis\//.test(page.url()),
    }
    const lines = new Map<string, string>()
    for (const f of await findFormFindings(page, place, abilities)) {
      lines.set(`${where}: ${f.rule} ${f.detail}`, f.rule)
    }
    return [...lines].map(([line, rule]) => ({ rule, line }))
  })
  expectWithinBaseline('form-fits', findings, BASELINE)
})
