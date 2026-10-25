import { DESIGN_VIEWPORTS } from 'gates/lib/designViewports'
import { expectCorpusClean } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { findSearchWidths } from './_searchWidth'
import { expect, test } from './fixtures'

/**
 * A search field is full width on a phone (`_searchWidth.ts`), on the
 * signed-out pages that draw one: an SRD listing's rail (the reference
 * corpus's `search` pages, `_designTable.ts`), and the header's search, a
 * row of its own under the bar. Play's tabs on a phone are held to it in `play-turn.e2e.ts`.
 * Each page must draw a field, so the gate never passes by reading nothing.
 */

/** Two phones, both under `sm`: R0's phone and a wide one. */
const WIDTHS = ['phone', 600] as const

test.use({ account: 'anonymous' })

test('every search field on a phone spans its line', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(3 * 60_000)
  await expectCorpusClean(page, 'search-width', () => findSearchWidths(page), {
    routes: corpusRoutes('search'),
    widths: WIDTHS,
    draws: '.su-search-field:visible',
    message: 'search fields narrower than their line on a phone',
  })
})

for (const viewport of [DESIGN_VIEWPORTS.phone, { width: 600, height: 900 }]) {
  test(`the header's search spans its line at ${viewport.width}px`, { tag: '@pr' }, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.goto(corpusRoutes('search')[0]?.path ?? '/chassis/', { waitUntil: 'networkidle' })
    await expect(
      page.locator('.su-union-bar').getByRole('combobox', { name: /search the reference/i })
    ).toBeVisible()
    expect(await findSearchWidths(page), 'the header search narrower than its line').toEqual([])
  })
}
