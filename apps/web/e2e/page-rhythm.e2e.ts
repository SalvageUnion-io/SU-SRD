import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { place } from './_findings'
import { openApp } from './_helpers'
import { findRhythm } from './_pageRhythm'
import { expect, test } from './fixtures'

/**
 * Hard rule R17, a Page has one rhythm (ruleset §1.7, §1.3, §7.1), on the
 * rendered Page (`_pageRhythm.ts`): a body starts under the band, short or long,
 * every level-1 block and the Slab heading one sits one 12px gap from the next, and the stat column's value
 * cells wear a 1px frame and its labels 14px type.
 *
 * The reference corpus's `rhythm` Pages (`_designTable.ts`: short and long SRD
 * Pages, a class page, a guide) and the app's Page (the detail dialog) opened
 * from a Starter Set sheet, each at R0's page and phone widths
 * (`DESIGN_VIEWPORTS`). There is no allowlist: every finding fails.
 */

/** The app's Page: a sheet's Mini or Ledger row opens its entity's Page in the detail dialog. */
const APP_PAGE = { sheet: '/starter/mech/starter-mech-mazona', token: 'Mini Mortar' }

test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('each kind of SRD Page keeps one rhythm', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(5 * 60_000)
  await expectCorpusClean(page, 'page-rhythm', () => findRhythm(page), {
    routes: corpusRoutes('rhythm'),
    draws: '.su-entity__body .su-entity-page',
    message: 'a Page off its rhythm',
  })
})

for (const [width, viewport] of Object.entries(DESIGN_VIEWPORTS)) {
  test.describe(`at ${width} width`, () => {
    test.use({ viewport })

    test("the app's Page keeps one rhythm", { tag: '@pr' }, async ({ page }) => {
      await openApp(page, APP_PAGE.sheet)
      // A phone's sheet keeps its lists under tabs, as Ledgers (ruleset §1.2, L9).
      const loadout = page.getByRole('tab', { name: /Loadout/ })
      if ((await loadout.count()) > 0) await loadout.first().click()
      // The loadout's own line: the Actions list above it names the system too, and only Peeks.
      await page
        .locator('.su-sheet-mech-loadout .su-entity-mini__name, .su-ledger__name')
        .filter({ hasText: APP_PAGE.token })
        .first()
        .click()
      await expect(page.locator('.su-entity-dialog__body .su-entity-page')).toBeVisible()
      const where = `the ${APP_PAGE.token} Page at ${width}`
      const failures = place(where, await findRhythm(page)).map((f) => f.line)
      expect(failures, "the app's Page off its rhythm").toEqual([])
    })
  })
}
