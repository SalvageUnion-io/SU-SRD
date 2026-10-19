import type { Page } from '@playwright/test'

/**
 * The sibling-height law (ruleset §4.7): controls side by side on one line —
 * chips, buttons, fields, switches, search boxes, Tokens — share one Size, so
 * one height. `findSiblingMismatches` reads the rendered page and returns every
 * line whose controls differ by a pixel or more.
 *
 * - A control is the outermost element matching `CONTROL`, so a chip's two
 *   plates count once, as their cell. A linked chip counts as its cell too:
 *   its button is a 24px target (WCAG 2.5.8) around the drawn 18px chip. A
 *   strip's Mini button is that target itself, its plate drawn on its padding
 *   box between transparent borders: it counts at the plate's height.
 * - Its line is its nearest flex or grid ancestor (four levels up at most)
 *   holding another control beside it: overlapping vertically by at least half
 *   the shorter one's height, and no more than `MAX_GAP` from its neighbour, so
 *   two columns of a form that happen to line up are not one line.
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
  '.su-stat-cell',
  '.su-badge-stamp',
  '.su-cost-edge',
  '.su-cost',
  '.su-entity-token',
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
  const controls = all.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false
    return true
  })
  // A control drawn on its padding box (a strip's Mini button: a 24px target,
  // its plate the chip's 18px inside a transparent border) measures as drawn.
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const clear = (side: 'top' | 'bottom') =>
      /rgba\(.*,\s*0\)$|transparent/.test(s.getPropertyValue(`border-${side}-color`))
        ? Number.parseFloat(s.getPropertyValue(`border-${side}-width`)) || 0
        : 0
    const drawn =
      s.backgroundClip === 'padding-box'
        ? { top: clear('top'), bottom: clear('bottom') }
        : { top: 0, bottom: 0 }
    return {
      el,
      x: r.left,
      y: r.top + drawn.top,
      w: r.width,
      h: r.height - drawn.top - drawn.bottom,
    }
  }
  const sameLine = (a: Box, b: Box) => {
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
