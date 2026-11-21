import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * A grid of items fills its rows (hard rule R68): every item grid on the page,
 * whatever its count and however many items its width gives a row, draws rows
 * that each run edge to edge. A short last row's items grow to share the line,
 * so there is never an empty track or an orphan cell.
 *
 * Three kinds of grid are read:
 * - `fill`: the one primitive, `.su-grid` (`foundation.css`): a row short of
 *   either edge;
 * - `orphan`: a CSS grid of equal tracks (`display: grid`, two or more tracks
 *   of one width) whose last row leaves a track empty: a hand-built item grid,
 *   which is `.su-grid`'s job;
 * - `column`: a masonry (`.su-masonry`, `.su-mini-grid`) with an empty column.
 *
 * `findFillGrid` reads the page: `measureGrids` takes the rendered boxes as
 * plain data and `findFillGridFaults`, pure, so
 * `e2e/__tests__/fillGrid.test.ts` holds it without a browser, judges them.
 */

type Box = { left: number; right: number; top: number }

/** One grid as drawn: its content box and its items' outer boxes, in order. */
export type GridBoxes = {
  kind: 'fill' | 'orphan' | 'column'
  label: string
  list: Box
  cells: Box[]
  /** A masonry's column gap: its last column may end this far short. */
  slack?: number
}

/** How far off an edge may be, for sub-pixel layout. */
const TOLERANCE = 1

/** Items, top down: those whose tops agree within the tolerance share a row. */
function rowsOf(cells: Box[]): Box[][] {
  const rows: Box[][] = []
  for (const cell of cells) {
    const row = rows.find((r) => Math.abs((r[0]?.top ?? 0) - cell.top) <= TOLERANCE)
    if (row) row.push(cell)
    else rows.push([cell])
  }
  return rows.sort((a, b) => (a[0]?.top ?? 0) - (b[0]?.top ?? 0))
}

const round = (n: number) => Math.round(n * 10) / 10

/** Each grid row that does not reach both edges of its list, `<kind>: …` a line apiece. */
export function findFillGridFaults(grids: GridBoxes[]): string[] {
  const faults: string[] = []
  for (const grid of grids) {
    if (grid.cells.length === 0) continue
    if (grid.kind === 'column') {
      const right = Math.max(...grid.cells.map((c) => c.right))
      const short = grid.list.right - right
      if (short > TOLERANCE + (grid.slack ?? 0))
        faults.push(`column: ${grid.label} leaves ${round(short)}px of columns empty`)
      continue
    }
    const rows = rowsOf(grid.cells)
    rows.forEach((row, index) => {
      // A hand-built grid is judged on its last row alone: the rows above fill by count.
      if (grid.kind === 'orphan' && index < rows.length - 1) return
      const gapLeft = Math.min(...row.map((c) => c.left)) - grid.list.left
      const gapRight = grid.list.right - Math.max(...row.map((c) => c.right))
      if (gapLeft > TOLERANCE || gapRight > TOLERANCE)
        faults.push(
          `${grid.kind}: ${grid.label}: row ${index + 1} of ${rows.length} (${row.length} items) leaves ${round(gapLeft)}px left, ${round(gapRight)}px right`
        )
    })
  }
  return faults
}

/** Every visible item grid on the page: its content box and each item's box. */
function measureGrids(page: Page): Promise<GridBoxes[]> {
  return page.evaluate(() => {
    const box = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top })
    const drawn = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.width >= 1 && r.height >= 1 && !el.closest('[aria-hidden="true"], [inert]')
    }
    const name = (el: Element) => {
      const cls = [...el.classList].filter((c) => c.startsWith('su-') && c !== 'su-grid')[0]
      return el.getAttribute('aria-label') ?? `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
    }
    const content = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      const px = (v: string) => Number.parseFloat(v) || 0
      return {
        left: r.left + px(s.paddingLeft) + px(s.borderLeftWidth),
        right: r.right - px(s.paddingRight) - px(s.borderRightWidth),
        top: r.top,
      }
    }
    const items = (el: Element) =>
      [...el.children].filter((child) => {
        const s = getComputedStyle(child)
        return drawn(child) && s.position !== 'absolute' && s.position !== 'fixed'
      })
    const out: {
      kind: 'fill' | 'orphan' | 'column'
      label: string
      list: Box
      cells: Box[]
      slack?: number
    }[] = []
    for (const el of document.querySelectorAll('body *')) {
      // A gauge's pips are one reading (§4.5), a table its own rows: neither is a grid of items.
      if (!drawn(el) || el.closest('[role="slider"], [role="img"], [role="meter"], table')) continue
      const s = getComputedStyle(el)
      if (el.classList.contains('su-grid')) {
        // The Stat drawn in a stat cell is the frame the reader sees, not the li.
        const cells = items(el).map((cell) =>
          box(
            (cell.querySelector(':scope > .su-stat-column__stat') ?? cell).getBoundingClientRect()
          )
        )
        out.push({ kind: 'fill', label: name(el), list: content(el), cells })
      } else if (s.display === 'grid' || s.display === 'inline-grid') {
        const tracks = s.gridTemplateColumns
          .split(' ')
          .map((t) => Number.parseFloat(t))
          .filter((t) => t > 0)
        const equal = tracks.length >= 2 && tracks.every((t) => Math.abs(t - (tracks[0] ?? 0)) <= 1)
        const cells = items(el)
        // Two or more whole items in equal tracks: a list, not a page's two halves.
        if (equal && cells.length >= 2 && cells.every((c) => c.tagName === cells[0]?.tagName))
          out.push({
            kind: 'orphan',
            label: name(el),
            list: content(el),
            cells: cells.map((c) => box(c.getBoundingClientRect())),
          })
      } else if (el.matches('.su-masonry, .su-mini-grid')) {
        out.push({
          kind: 'column',
          label: name(el),
          list: content(el),
          cells: items(el).map((c) => box(c.getBoundingClientRect())),
          slack: Number.parseFloat(s.columnGap) || 0,
        })
      }
    }
    return out
  })
}

/** Every item grid row on the page that does not run edge to edge. */
export async function findFillGrid(page: Page): Promise<Finding[]> {
  return fromFaults(findFillGridFaults(await measureGrids(page)))
}
