import type { Page } from '@playwright/test'
import { DESIGN_VIEWPORTS } from './_designTable'
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
 * Short and long SRD Pages, and the app's Page (the detail dialog) opened from
 * a Starter Set sheet, each at R0's page and phone widths (`DESIGN_VIEWPORTS`).
 * There is no allowlist: every finding fails.
 */
const PAGES = {
  short: ['/crawler-bays/armoury/', '/systems/salvaging-drill/'],
  long: [
    '/chassis/mazona/',
    '/chassis/mazona/pattern/buzzard/',
    '/chassis/big-brother/',
    '/npcs/saboteur/',
    '/bio-titans/tyrant/',
    '/drones/pest-drone/',
  ],
}

/** The app's Page: a sheet's Token opens its entity's Page in the detail dialog. */
const APP_PAGE = { sheet: '/starter/mech/starter-mech-mazona', token: 'Mini Mortar' }

test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

async function scan(page: Page, where: string): Promise<string[]> {
  return describeRhythm(where, await findRhythmFindings(page))
}

for (const [width, viewport] of Object.entries(DESIGN_VIEWPORTS)) {
  test.describe(`at ${width} width`, () => {
    test.use({ viewport })

    test('a short and a long SRD Page keep one rhythm', async ({ page }) => {
      test.setTimeout(5 * 60_000)
      const failures: string[] = []
      for (const [length, paths] of Object.entries(PAGES)) {
        for (const path of paths) {
          await page.goto(path, { waitUntil: 'networkidle' })
          await expect(page.locator('.su-entity__body .su-entity-page')).toBeVisible()
          failures.push(...(await scan(page, `${path} (${length}) at ${width}`)))
        }
      }
      expect(failures, 'a Page off its rhythm').toEqual([])
    })

    test("the app's Page keeps one rhythm", async ({ page }) => {
      await gotoStable(page, APP_PAGE.sheet)
      await waitForReady(page)
      const token = page.locator('.su-entity-token').filter({ hasText: APP_PAGE.token }).first()
      await token.locator('.su-entity-token__name').click()
      await expect(page.locator('.su-entity-dialog__body .su-entity-page')).toBeVisible()
      const failures = await scan(page, `the ${APP_PAGE.token} Page at ${width}`)
      expect(failures, "the app's Page off its rhythm").toEqual([])
    })
  })
}
