import { expectCorpusClean } from './_designRoutes'
import { findFillGrid } from './_fillGrid'
import { test } from './fixtures'

/**
 * Hard rule R68, a grid of items fills its rows (`_fillGrid.ts`): every item
 * grid (`.su-grid`) draws rows that run edge to edge, a short last row's
 * items growing to share the line; no hand-built grid leaves an orphan cell
 * and no masonry an empty column.
 *
 * The reference corpus (`_designTable.ts`), at R0's phone and page and one
 * width between, where a Page's lists hold another count a row; the
 * signed-in surfaces are `design-walk.e2e.ts`'s. There is no
 * allowlist: every finding fails.
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every item grid fills its rows at every width', { tag: '@pr' }, async ({ page }) => {
  test.setTimeout(10 * 60_000)
  await expectCorpusClean(page, 'fill-grid', () => findFillGrid(page), {
    widths: ['phone', 900, 'page'],
    message: 'an item grid short of its row',
  })
})
