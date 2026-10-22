import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * A stat grid fills its width (ruleset, "The source" 3): every `StatColumn`
 * on the page, whatever its stat count and however many columns its width
 * gives it, draws rows that each run edge to edge. A short last row's cells grow to share the
 * line, so there is never an empty cell or a ragged edge.
 *
 * `findStatFill` reads the page: `measureStatColumns` takes the rendered boxes
 * as plain data and `findStatFillFaults`, pure, so
 * `e2e/__tests__/statFill.test.ts` holds it without a browser, judges them.
 */

type Box = { left: number; right: number; top: number }

/** One stat grid as drawn: its content box and its cells' outer boxes, in order. */
export type StatColumnBoxes = { label: string; list: Box; cells: Box[] }

/** How far off an edge may be, for sub-pixel layout. */
const STAT_FILL_TOLERANCE = 1

/** Compacts, top down: cells whose tops agree within the tolerance share a row. */
function rowsOf(cells: Box[]): Box[][] {
  const rows: Box[][] = []
  for (const cell of cells) {
    const row = rows.find((r) => Math.abs((r[0]?.top ?? 0) - cell.top) <= STAT_FILL_TOLERANCE)
    if (row) row.push(cell)
    else rows.push([cell])
  }
  return rows.sort((a, b) => (a[0]?.top ?? 0) - (b[0]?.top ?? 0))
}

/** Each row of each grid that does not reach both edges of its list, one line apiece. */
export function findStatFillFaults(columns: StatColumnBoxes[]): string[] {
  const faults: string[] = []
  const round = (n: number) => Math.round(n * 10) / 10
  for (const column of columns) {
    const rows = rowsOf(column.cells)
    rows.forEach((row, index) => {
      const left = Math.min(...row.map((c) => c.left))
      const right = Math.max(...row.map((c) => c.right))
      const gapLeft = left - column.list.left
      const gapRight = column.list.right - right
      if (gapLeft > STAT_FILL_TOLERANCE || gapRight > STAT_FILL_TOLERANCE)
        faults.push(
          `${column.label}: row ${index + 1} of ${rows.length} (${row.length} cells) leaves ${round(gapLeft)}px left, ${round(gapRight)}px right`
        )
    })
  }
  return faults
}

/** Every visible stat grid on the page, its list's content box and each cell's Stat. */
function measureStatColumns(page: Page): Promise<StatColumnBoxes[]> {
  return page.evaluate(() => {
    const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top })
    const out: { label: string; list: Box; cells: Box[] }[] = []
    for (const list of document.querySelectorAll('.su-stat-column')) {
      const r = list.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || list.closest('[aria-hidden="true"], [inert]')) continue
      const s = getComputedStyle(list)
      const padLeft = Number.parseFloat(s.paddingLeft) + Number.parseFloat(s.borderLeftWidth)
      const padRight = Number.parseFloat(s.paddingRight) + Number.parseFloat(s.borderRightWidth)
      // The Stat drawn in each cell: the frame the reader sees, not the li.
      const cells = [...list.querySelectorAll(':scope > .su-stat-column__cell')].map((cell) =>
        box((cell.querySelector('.su-stat-column__stat') ?? cell).getBoundingClientRect())
      )
      out.push({
        label: list.getAttribute('aria-label') ?? 'a stat column',
        list: { left: r.left + padLeft, right: r.right - padRight, top: r.top },
        cells,
      })
    }
    return out
  })
}

/** Every stat grid row on the page that does not run edge to edge. */
export async function findStatFill(page: Page): Promise<Finding[]> {
  return fromFaults(findStatFillFaults(await measureStatColumns(page)), 'fill')
}
