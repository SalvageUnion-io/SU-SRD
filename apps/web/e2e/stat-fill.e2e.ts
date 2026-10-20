import { gotoStable, waitForReady } from './_helpers'
import { findStatFillFaults, measureStatColumns } from './_statFill'
import { expect, test } from './fixtures'

/**
 * Ruleset "The source" 3, a stat grid fills its width (`_statFill.ts`): every
 * `StatColumn` draws rows that run edge to edge, a short last row's cells
 * growing to share the line, so there is never an empty cell or a ragged edge.
 *
 * Each surface that draws one, at widths that give the page's column one to
 * five cells a row and the phone's two: two chassis and a pattern (`CardPage`'s
 * column; a homebrew pattern's Page is the same one) and the mech sheet's hero
 * (the compact column, two a line). An NPC's or a crawler's stats ride its
 * band as chips, not a grid. There is no allowlist: every finding fails, and
 * each surface must draw a stat column.
 */
const REFERENCE = ['/chassis/mazona/', '/chassis/mazona/pattern/buzzard/', '/chassis/big-brother/']

/** The app's mech sheet: its hero's compact column. */
const MECH_SHEET = '/starter/mech/starter-mech-mazona'

const WIDTHS = [390, 700, 900, 1100, 1440]

test.use({ account: 'anonymous' })
test.describe.configure({ retries: 0 })

test('every stat grid fills its width at every width', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  const failures: string[] = []
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of REFERENCE) {
      await page.goto(path, { waitUntil: 'networkidle' })
      const columns = await measureStatColumns(page)
      expect(columns.length, `${path} draws a stat column at ${width}px`).toBeGreaterThan(0)
      failures.push(...findStatFillFaults(columns).map((f) => `${path} at ${width}px: ${f}`))
    }
    await gotoStable(page, MECH_SHEET)
    await waitForReady(page)
    await expect(page.locator('.su-stat-column').first()).toBeVisible()
    const columns = await measureStatColumns(page)
    failures.push(...findStatFillFaults(columns).map((f) => `${MECH_SHEET} at ${width}px: ${f}`))
  }
  expect(failures, 'a stat grid short of its width').toEqual([])
})
