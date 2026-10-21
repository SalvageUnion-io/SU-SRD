import { walkDesignRoutes } from './_designRoutes'
import { corpusRoutes } from './_designTable'
import { findStatFillFaults, measureStatColumns } from './_statFill'
import { expect, test } from './fixtures'

/**
 * Ruleset "The source" 3, a stat grid fills its width (`_statFill.ts`): every
 * `StatColumn` draws rows that run edge to edge, a short last row's cells
 * growing to share the line, so there is never an empty cell or a ragged edge.
 *
 * Each surface that draws one, the reference corpus's `stat-column` pages
 * (`_designTable.ts`): two chassis and a pattern (`CardPage`'s column; a
 * homebrew pattern's Page is the same one) and the mech sheet's hero (the
 * compact column, two a line), at R0's phone and page and the widths between
 * that give the page's column one to five cells a row. An NPC's or a
 * crawler's stats ride its band as chips, not a grid. There is no allowlist:
 * every finding fails, and each surface must draw a stat column.
 */
test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every stat grid fills its width at every width', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const found = await walkDesignRoutes(
    page,
    async ({ where }) => {
      await expect(
        page.locator('.su-stat-column').first(),
        `${where} draws a stat column`
      ).toBeVisible()
      const columns = await measureStatColumns(page)
      return findStatFillFaults(columns).map((f) => ({ rule: 'fill', line: `${where}: ${f}` }))
    },
    { routes: corpusRoutes('stat-column'), widths: ['phone', 700, 900, 1100, 'page'] }
  )
  expect(
    found.map((f) => f.line),
    'a stat grid short of its width'
  ).toEqual([])
})
