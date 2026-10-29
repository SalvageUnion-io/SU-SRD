import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * The sibling-height law (ruleset §4.7): controls side by side on one line —
 * chips, buttons, fields, switches, search boxes, Minis — share one Size, so
 * one height. `findSiblingHeights` reads the rendered page and returns every
 * line whose controls differ by a pixel or more (`findSiblingMismatches`, the
 * same as data).
 *
 * - A control is the outermost element matching `CONTROL`, so a chip's two
 *   plates count once, as their cell. A linked chip counts as its cell too.
 * - Its line is its nearest flex or grid ancestor (four levels up at most)
 *   holding another control beside it: overlapping vertically by at least half
 *   the shorter one's height, and no more than `MAX_GAP` from its neighbour, so
 *   two columns of a form that happen to line up are not one line. A line
 *   never crosses a labelled section's edge: Play's columns (`PlayFrame`)
 *   stand a gutter apart, so an action Mini is never one line with the
 *   Units column's steppers or the Tables column's Minis.
 * - A section head (`Slab`) is a line of its own: its name stamp, its count
 *   and its actions share one height.
 */
export type SiblingMismatch = {
  /** The line's element, as `tag.class.class`. */
  line: string
  /** Each control on it: its height in px and what it is. */
  controls: { height: number; what: string }[]
}

const CONTROL = [
  'button:not(.su-chip-link)',
  'a.su-btn',
  '[role=button]:not(.su-chip-link)',
  '[role=radio]',
  '[role=tab]',
  'input:not([type=hidden]):not([type=checkbox]):not([type=radio])',
  'select',
  // A stat column's cell is a read-out in the column's own grid, not a control
  // on a line (`StatColumn`, a layout of Stats).
  '.su-stat-cell:not(.su-stat-column__stat)',
  '.su-badge-stamp',
  '.su-cost-edge',
  '.su-cost',
  '.su-entity-mini',
  '.su-seg',
  '.su-search-field',
].join(',')

/** Two controls further apart than this are not neighbours on one line. */
const MAX_GAP = 48

/** Runs in the page; returns plain data. */
function scan({
  control,
  maxGap,
  within,
}: {
  control: string
  maxGap: number
  within: string | null
}): SiblingMismatch[] {
  type Box = { el: Element; x: number; y: number; w: number; h: number }
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const all = [...document.querySelectorAll(control)]
    .filter(visible)
    .filter((el) => within === null || el.closest(within) !== null)
  const set = new Set(all)
  const controls = all
    .filter((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false
      return true
    })
    // A contentful Mini (and all it holds) is a block of text under a head,
    // not a control on a line: Minis side by side in a masonry grid
    // (`MiniGrid`) differ in height by their text.
    .filter((el) => !el.matches('.su-entity-mini[data-contentful]'))
  // A control in a tap target wider than it draws (a strip's Mini button: a
  // transparent border, its fill clipped inside) measures as what it draws.
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    if (s.backgroundClip !== 'padding-box' || s.borderTopColor !== 'rgba(0, 0, 0, 0)') {
      return { el, x: r.left, y: r.top, w: r.width, h: r.height }
    }
    const [top, right, bottom, left] = [
      s.borderTopWidth,
      s.borderRightWidth,
      s.borderBottomWidth,
      s.borderLeftWidth,
    ].map(Number.parseFloat) as [number, number, number, number]
    return {
      el,
      x: r.left + left,
      y: r.top + top,
      w: r.width - left - right,
      h: r.height - top - bottom,
    }
  }
  const column = (el: Element) => el.closest('section[aria-label]')
  const sameLine = (a: Box, b: Box) => {
    if (column(a.el) !== column(b.el)) return false
    const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    const apart = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)
    return overlap >= 0.5 * Math.min(a.h, b.h) && apart > -2 && apart <= maxGap
  }
  const isLayout = (el: Element) => /flex|grid/.test(getComputedStyle(el).display)
  const describe = (el: Element) => {
    const cls = [...el.classList].slice(0, 2).join('.')
    const text = (el.getAttribute('aria-label') ?? el.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${text}"`
  }
  const seen = new Set<string>()
  const found: SiblingMismatch[] = []
  for (const [i, c] of controls.entries()) c.setAttribute('data-sibling-scan', String(i))
  for (const c of controls) {
    let line = c.parentElement
    for (let depth = 0; line && depth < 4; depth++, line = line.parentElement) {
      if (!isLayout(line)) continue
      const inLine = controls.filter((o) => line?.contains(o)).map(box)
      const group = [box(c)]
      let grew = true
      while (grew) {
        grew = false
        for (const o of inLine) {
          if (group.some((g) => g.el === o.el)) continue
          if (group.some((g) => sameLine(g, o))) {
            group.push(o)
            grew = true
          }
        }
      }
      if (group.length < 2) continue
      const heights = group.map((g) => Math.round(g.h))
      const key = group
        .map((g) => g.el.getAttribute('data-sibling-scan'))
        .sort()
        .join(',')
      if (Math.max(...heights) - Math.min(...heights) >= 1 && !seen.has(key)) {
        seen.add(key)
        found.push({
          line: `${line.tagName.toLowerCase()}.${[...line.classList].join('.')}`,
          controls: group.map((g, k) => ({ height: heights[k] ?? 0, what: describe(g.el) })),
        })
      }
      break
    }
  }
  // A section head (`Slab`): its name stamp and every control in its row,
  // its count and actions, are one line.
  for (const row of document.querySelectorAll('[data-slab]')) {
    const name = row.firstElementChild
    if (!name || !visible(name)) continue
    if (within !== null && row.closest(within) === null) continue
    const group = [name, ...controls.filter((o) => row.contains(o))].map(box)
    if (group.length < 2) continue
    const heights = group.map((g) => Math.round(g.h))
    if (Math.max(...heights) - Math.min(...heights) >= 1) {
      found.push({
        line: `div[data-slab] "${describe(name)}"`,
        controls: group.map((g, k) => ({ height: heights[k] ?? 0, what: describe(g.el) })),
      })
    }
  }
  for (const c of controls) c.removeAttribute('data-sibling-scan')
  return found
}

/**
 * Every mismatched line on the page, or, with `within` (a selector), only the
 * lines of controls inside what it matches: a surface's own lines, where the
 * rest of the page is another spec's.
 */
export function findSiblingMismatches(page: Page, within?: string): Promise<SiblingMismatch[]> {
  return page.evaluate(scan, { control: CONTROL, maxGap: MAX_GAP, within: within ?? null })
}

/** Each mismatched line in words: the line, then every control on it at its height. */
export function describeMismatch(m: SiblingMismatch): string {
  return `${m.line}: ${m.controls.map((c) => `${c.height}px ${c.what}`).join(', ')}`
}

/** `findSiblingMismatches` as findings, each a `sibling` line. */
export async function findSiblingHeights(page: Page, within?: string): Promise<Finding[]> {
  return fromFaults((await findSiblingMismatches(page, within)).map(describeMismatch), 'sibling')
}

/**
 * A Button beside Tabs (or a Segmented row) is their Size (ruleset §4.7,
 * R41):
 * on the Tabs' line or in the band that holds them (the nearest ancestor,
 * four levels up at most, that holds a Button too), every Button but a
 * strip's chip is a tab's height. One `tab-size:` line per Button off it.
 */
function scanTabSize(): string[] {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const text = (el: Element) =>
    (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)
  const faults: string[] = []
  const seen = new Set<Element>()
  // Tabs, or a Segmented row drawn as tabs (a sheet's Read | Edit).
  for (const list of document.querySelectorAll('[role="tablist"], .su-seg')) {
    const tab = [...list.querySelectorAll('[role="tab"], .su-seg__option')].find(visible)
    if (!tab) continue
    const height = Math.round(tab.getBoundingClientRect().height)
    let band = list.parentElement
    const buttons = (el: Element) =>
      [...el.querySelectorAll('.su-btn')].filter(
        (b) =>
          visible(b) &&
          !list.contains(b) &&
          !b.closest('[data-chip-group], [data-chip-class], [role="menu"], [role="dialog"]')
      )
    for (let up = 0; band && up < 4 && buttons(band).length === 0; up++) band = band.parentElement
    if (!band) continue
    for (const b of buttons(band)) {
      if (seen.has(b)) continue
      seen.add(b)
      const h = Math.round(b.getBoundingClientRect().height)
      if (Math.abs(h - height) > 1) {
        faults.push(`tab-size: "${text(b)}" is ${h}px beside ${height}px Tabs ("${text(tab)}")`)
      }
    }
  }
  return faults
}

/** Every Button beside Tabs that is not the Tabs' height. */
export async function findTabSizes(page: Page): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scanTabSize))
}
