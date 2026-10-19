import type { DesignDebt } from './_designRoutes'
import { expectWithinBaseline, seedDesignAccount, walkDesignRoutes } from './_designRoutes'
import { designRoutes } from './_helpers'
import { findSheetGrammar } from './_sheetGrammar'
import { test } from './fixtures'

/**
 * Hard rule R11, one Live Sheet grammar (ruleset §0, §1.2), kind by kind:
 * the pilot, mech, crawler and NPC sheets of hard rule R0's `designRoutes`
 * (`sheet-<kind>-read`, `sheet-<kind>-edit`), seeded, at page and phone
 * widths, each held to `_sheetGrammar.ts`: `LiveSheet`'s band with its
 * corner actions and Read | Edit, a `SheetHero` opening whose vitals are
 * `SheetVitalGauge`s in full words, a typeset Read (no field, stepper or
 * empty section), and in Edit the one remove control.
 *
 * No baseline: every finding fails.
 */
const BASELINE: readonly DesignDebt[] = []

const KINDS = ['pilot', 'mech', 'crawler', 'npc'] as const

for (const kind of KINDS) {
  test(`the ${kind} sheet keeps the one sheet grammar`, async ({ page }) => {
    test.setTimeout(10 * 60_000)
    const seed = await seedDesignAccount(page)
    const routes = designRoutes.filter((r) => r.family.startsWith(`sheet-${kind}-`))
    const findings = await walkDesignRoutes(
      page,
      seed,
      async ({ where }) => {
        const edit = where.includes(', Edit')
        return (await findSheetGrammar(page, { edit })).map((f) => ({
          rule: f.rule,
          line: `${where}: ${f.detail}`,
        }))
      },
      routes
    )
    expectWithinBaseline('sheet-grammar', findings, BASELINE)
  })
}
