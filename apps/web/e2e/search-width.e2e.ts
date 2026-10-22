import { expect, test } from '@playwright/test'
import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { searchWidthFaults } from './_searchWidth'

/**
 * A search field is full width on a phone (`_searchWidth.ts`), on the
 * signed-out pages that draw one: an SRD listing's rail (the reference
 * corpus's `search` pages, `_designTable.ts`), and the header's search opened
 * from its magnifier. Play's phone form is held to it in `play-turn.e2e.ts`.
 * Each page must draw a field, so the gate never passes by reading nothing.
 */

/** Two phones, both under `sm`: R0's phone and a wide one. */
const WIDTHS = ['phone', 600] as const

test('every search field on a phone spans its line', async ({ page }) => {
  test.setTimeout(3 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    const found = await walkDesignRoutes(
      page,
      async ({ where }) => {
        await expect(
          page.locator('.su-search-field:visible').first(),
          `${where} draws a search`
        ).toBeVisible()
        return (await searchWidthFaults(page)).map((fault) => ({
          rule: 'width',
          line: `${where}: ${fault}`,
        }))
      },
      { routes: corpusRoutes('search'), widths: [width] }
    )
    failures.push(...found.map((f) => f.line))
    // The header's search, opened from its magnifier, on the last page walked.
    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click()
    await expect(page.getByRole('combobox').first()).toBeVisible()
    for (const fault of await searchWidthFaults(page)) failures.push(`header at ${width}: ${fault}`)
  }
  expect(failures, 'search fields narrower than their line on a phone').toEqual([])
})
