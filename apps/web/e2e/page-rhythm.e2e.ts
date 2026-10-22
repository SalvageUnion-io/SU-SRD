import type { Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { gotoStable, waitForReady } from './_helpers'
import { describeRhythm, findRhythmFindings } from './_pageRhythm'
import { expect, test } from './fixtures'

/**
 * Hard rule R17, a Page has one rhythm (ruleset §1.7, §1.3, §7.1), on the
 * rendered Page (`_pageRhythm.ts`): the body starts under the band at any
 * length (a short page is never centred), every level-1 block and the Slab
 * heading one sits one 12px gap from the next, and the stat column's value
 * cells wear a 1px frame and its labels 14px type.
 *
 * The reference corpus's `rhythm` Pages (`_designTable.ts`: short and long SRD
 * Pages, a class page, a guide) and the app's Page (the detail dialog) opened
 * from a Starter Set sheet, each at R0's page and phone widths
 * (`DESIGN_VIEWPORTS`). There is no allowlist: every finding fails.
 */

/** The app's Page: a sheet's Mini opens its entity's Page in the detail dialog. */
const APP_PAGE = { sheet: '/starter/mech/starter-mech-mazona', token: 'Mini Mortar' }

test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

async function scan(page: Page, where: string): Promise<string[]> {
  return describeRhythm(where, await findRhythmFindings(page))
}

test('each kind of SRD Page keeps one rhythm', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const found = await walkDesignRoutes(
    page,
    async ({ where }) => {
      await expect(page.locator('.su-entity__body .su-entity-page')).toBeVisible()
      return (await scan(page, where)).map((line) => ({ rule: 'rhythm', line }))
    },
    { routes: corpusRoutes('rhythm') }
  )
  expect(
    found.map((f) => f.line),
    'a Page off its rhythm'
  ).toEqual([])
})

for (const [width, viewport] of Object.entries(DESIGN_VIEWPORTS)) {
  test.describe(`at ${width} width`, () => {
    test.use({ viewport })

    test("the app's Page keeps one rhythm", async ({ page }) => {
      await gotoStable(page, APP_PAGE.sheet)
      await waitForReady(page)
      const token = page.locator('.su-entity-mini').filter({ hasText: APP_PAGE.token }).first()
      await token.locator('.su-entity-mini__name').click()
      await expect(page.locator('.su-entity-dialog__body .su-entity-page')).toBeVisible()
      const failures = await scan(page, `the ${APP_PAGE.token} Page at ${width}`)
      expect(failures, "the app's Page off its rhythm").toEqual([])
    })
  })
}
