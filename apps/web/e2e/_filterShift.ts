import type { Page } from '@playwright/test'

/**
 * A filter moves only its results (chrome K17): pressing a listing's filter,
 * sort or find leaves its controls, everything above them and its table's
 * columns where they stood, within a pixel; what the filter found below may
 * change, as it should.
 *
 * `measureFilterFrame` reads the page as plain boxes keyed by what each thing
 * is: the page's header and band, every control in the filter rail, the
 * status line (where it starts: its tokens come and go with the filters, on
 * a line of their own under the controls), the List's column heads, and the
 * scroll.
 * `findFilterShiftFaults`, pure, so `e2e/__tests__/filterShift.test.ts` holds
 * it without a browser, compares two readings.
 */

type Box = { x: number; y: number; w: number; h: number }

/** One reading: the boxes by key, and whether a phone's facets panel is open. */
export type FilterFrame = {
  boxes: Record<string, Box>
  /** Keys of the facets inside a phone's folding panel (`.su-rail__facets`). */
  facets: string[]
  /** The panel is open (`.su-rail[data-open]`): a phone's facets are drawn. */
  open: boolean
  /** The open panel's top: what stands below it rises when it folds. */
  panelTop: number
  scrollY: number
}

/** How far a box may move, for sub-pixel layout. */
const TOLERANCE = 1

const round = (n: number) => Math.round(n * 10) / 10

/**
 * What moved between `before` and `after`, a line apiece. A control that goes
 * is a fault, but for a phone's facets when their panel folded (a choice
 * from a menu folds it, r5 E8: the panel closing is the reader's act) and
 * the List's heads when nothing matched (the empty state stands for it).
 */
export function findFilterShiftFaults(before: FilterFrame, after: FilterFrame): string[] {
  const faults: string[] = []
  const folded = before.open && !after.open
  for (const [key, was] of Object.entries(before.boxes)) {
    const now = after.boxes[key]
    // A folded panel takes its facets, and lifts what stood below it.
    const facet = before.facets.includes(key) || (folded && was.y >= before.panelTop)
    if (!now) {
      // The List goes with its rows when nothing matches: it is the results.
      if (!(folded && facet) && !key.startsWith('column ')) faults.push(`${key} went`)
      continue
    }
    if (folded && facet) continue
    const moved = (['x', 'y', 'w', 'h'] as const)
      .map((side) => [side, now[side] - was[side]] as const)
      .filter(([, by]) => Math.abs(by) > TOLERANCE)
    if (moved.length > 0)
      faults.push(
        `${key} moved ${moved.map(([side, by]) => `${side} ${by > 0 ? '+' : ''}${round(by)}px`).join(', ')}`
      )
  }
  const scrolled = after.scrollY - before.scrollY
  if (Math.abs(scrolled) > TOLERANCE) faults.push(`the page scrolled ${round(scrolled)}px`)
  return faults
}

/** Reads the filter frame of the listing on `page`. */
export function measureFilterFrame(page: Page): Promise<FilterFrame> {
  return page.evaluate(() => {
    const boxes: Record<string, Box> = {}
    const facets: string[] = []
    const seen = new Map<string, number>()
    const put = (base: string, el: Element, facet = false) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      const key = n > 1 ? `${base} #${n}` : base
      boxes[key] = { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height }
      if (facet) facets.push(key)
    }
    const header = document.querySelector('body > header, header')
    if (header) put('the header', header)
    const band = document.querySelector('.su-chapter-band')
    if (band) put('the band', band)
    // The status line by where it starts and its width: its count and
    // tokens change with the filters, and its wrapped tokens push only the list.
    for (const status of document.querySelectorAll('.su-rail__status')) {
      put('the status line', status)
      const key = Object.keys(boxes).at(-1)
      if (key && boxes[key]) boxes[key].h = 0
    }
    for (const el of document.querySelectorAll('.su-rail :is(button, select, input, fieldset)')) {
      if (el.closest('.su-rail__status')) continue
      // A control by what it is, never by a count it prints (Filters 2).
      const name = (
        el.getAttribute('aria-label') ??
        el.querySelector('legend')?.textContent ??
        el.textContent ??
        ''
      )
        .replace(/\d+(\s*active)?/g, '')
        .trim()
      put(`${el.tagName.toLowerCase()} "${name}"`, el, el.closest('.su-rail__facets') !== null)
    }
    const results = document.getElementById('srd-listing-results')
    for (const th of results?.querySelectorAll('thead th') ?? []) {
      // A column head's box, its height free: the head strip is the list's.
      put(`column "${th.textContent?.trim() || 'name'}"`, th)
    }
    const panel = document.querySelector('.su-rail[data-open] .su-rail__facets')
    const panelTop = panel ? panel.getBoundingClientRect().top + window.scrollY : Infinity
    return { boxes, facets, open: panel !== null, panelTop, scrollY: window.scrollY }
  })
}
