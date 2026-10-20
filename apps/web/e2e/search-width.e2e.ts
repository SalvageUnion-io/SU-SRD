import { expect, test } from '@playwright/test'
import { searchWidthFaults } from './_searchWidth'

/**
 * A search field is full width on a phone (owner's rule, 2026-10-20;
 * `_searchWidth.ts`), on the signed-out pages that draw one: an SRD listing's
 * rail, the header's search opened from its magnifier. Play's phone form is
 * held to it in `play-turn.e2e.ts`. Each page must draw a field, so the gate
 * never passes by reading nothing.
 */
const PAGES = ['/chassis/', '/systems/', '/abilities/']

/** Two phones: a narrow one and a wide one, both under `sm`. */
const WIDTHS = [375, 600]

test('every search field on a phone spans its line', async ({ page }) => {
  test.setTimeout(3 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of PAGES) {
      await page.goto(path, { waitUntil: 'networkidle' })
      await expect(
        page.locator('.su-search-field:visible').first(),
        `${path} draws a search`
      ).toBeVisible()
      for (const fault of await searchWidthFaults(page))
        failures.push(`${path} at ${width}px: ${fault}`)
    }
    // The header's search, opened from its magnifier.
    await page
      .getByRole('button', { name: /search/i })
      .first()
      .click()
    await expect(page.getByRole('combobox').first()).toBeVisible()
    for (const fault of await searchWidthFaults(page))
      failures.push(`header at ${width}px: ${fault}`)
  }
  expect(failures, 'search fields narrower than their line on a phone').toEqual([])
})
