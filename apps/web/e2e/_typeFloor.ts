import type { Page } from '@playwright/test'

/**
 * The type floor at render (ruleset §4.6, hard rule R12): no text under 11px
 * as the reader sees it. The `tokens/type-floor` rule checks the source; this
 * reads the page: every visible element that holds text, its computed
 * `font-size` times every scale above it (a `transform`, a `zoom`), so a
 * canvas drawn small or a label scaled down counts at the size it is drawn.
 *
 * `findTypeFloorFaults` returns one line per element under the floor:
 * `<px>px <tag.class> "<text>"`.
 */

/** The floor, in CSS px at a scale of 1. */
const FLOOR = 11

/** Rounding slack: a computed size is a float, and a scale multiplies it. */
const SLACK = 0.005

/** Runs in the page; returns plain data. */
function scan({ floor, slack }: { floor: number; slack: number }): string[] {
  const out: string[] = []
  const scaleOf = (el: Element): number => {
    let scale = 1
    for (let a: Element | null = el; a; a = a.parentElement) {
      const s = getComputedStyle(a)
      if (s.transform && s.transform !== 'none') {
        const m = new DOMMatrix(s.transform)
        scale *= Math.hypot(m.a, m.b)
      }
      const zoom = Number.parseFloat(s.zoom || '1')
      if (zoom > 0 && zoom !== 1) scale *= zoom
    }
    return scale
  }
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    if (!text) continue
    const el = node.parentElement
    if (!el || seen.has(el)) continue
    seen.add(el)
    // Drawn: a box past a visually-hidden 1px one, not hidden.
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    const px = Number.parseFloat(style.fontSize) * scaleOf(el)
    if (px < floor - slack) {
      const cls = [...el.classList].slice(0, 2).join('.')
      out.push(
        `${px.toFixed(1)}px ${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${text.slice(0, 24)}"`
      )
    }
  }
  return out
}

/** Every text on the page drawn under the 11px floor, one line each. */
export function findTypeFloorFaults(page: Page): Promise<string[]> {
  return page.evaluate(scan, { floor: FLOOR, slack: SLACK })
}
