import type { Page } from '@playwright/test'

/**
 * The two inviolable laws (ruleset §7), read off the rendered page (hard rule
 * R31). Each finding is `<rule>: <what>`, its rule one of:
 *
 * - `fill` (§7.1): a `Stat` cell's value plate (`.su-stat-plate--value`) is
 *   paper, or transparent over a paper ground; never cream, white, a tint or
 *   any other fill.
 * - `frame` (§7.1): the cell around it (`.su-stat-cell`) has a solid 1px frame
 *   on every side, in ink; on an ink ground (chrome K1) the frame is a paper
 *   rule (`data-ground="ink"` on its frame, unless what is actually under the
 *   cell is light: a chip that drops off an ink band onto a paper strip, a
 *   phone's Compact head, is held to ink again), and a state (`good`, `caution`,
 *   `critical`) recolours it, as `Stat`'s one lever does.
 * - `seam` (§7.2): a border-riding stamp (`STAMP_SEAM`, `.su-stamp-seam`)
 *   centres on its frame's top border line within 1px. Its frame is the box it
 *   is placed in, or, where that box draws no border (a `Field`, whose control
 *   owns it), the first bordered box inside it.
 *
 * A finding names the thing at fault by its text, never its pixel measures
 * alone, so a baseline can match it on any machine's fonts.
 */

/** How far a seam stamp's centre may sit off its border line, in px. */
const SEAM_TOLERANCE = 1

/** Runs in the page; returns one line per fault. */
function scan(tolerance: number): { faults: string[]; cells: number; seams: number } {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  /** A token's colour as the browser computes it (`rgb(…)`). */
  const probe = document.createElement('span')
  document.body.append(probe)
  const tokenColour = (name: string) => {
    probe.style.color = `var(${name})`
    return getComputedStyle(probe).color
  }
  const ink = tokenColour('--color-ink')
  const paper = tokenColour('--color-paper')
  const states: Record<string, string> = {
    'su-stat-cell--good': tokenColour('--color-mech'),
    'su-stat-cell--caution': tokenColour('--color-status-warn'),
    'su-stat-cell--critical': tokenColour('--color-status-bad'),
  }
  probe.remove()

  const transparent = (c: string) => c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c)
  /** The colour actually under an element: its nearest ancestor with an opaque fill. */
  const groundOf = (el: Element): string => {
    for (let at = el.parentElement; at; at = at.parentElement) {
      const bg = getComputedStyle(at).backgroundColor
      if (!transparent(bg)) return bg
    }
    return getComputedStyle(document.body).backgroundColor
  }
  /** A light ground (paper, cream): an ink rule shows on it, whatever the frame declares. */
  const light = (c: string) => {
    const [r = 0, g = 0, b = 0] = (c.match(/[\d.]+/g) ?? []).map(Number)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200
  }
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)

  const out: string[] = []
  let cells = 0
  let seams = 0

  // §7.1: every value cell.
  for (const cell of document.querySelectorAll('.su-stat-cell')) {
    const value = cell.querySelector(':scope > .su-stat-plate--value')
    if (!value || !visible(cell)) continue
    cells++
    const what = `"${text(cell)}"`
    const fill = getComputedStyle(value).backgroundColor
    const ground = groundOf(value)
    if (!(fill === paper || (transparent(fill) && ground === paper))) {
      out.push(`fill: ${what} value is ${fill} on ${transparent(fill) ? ground : 'its cell'}`)
    }
    const s = getComputedStyle(cell)
    const declared = cell.closest('[data-ground]')?.getAttribute('data-ground')
    const onInk = declared === 'ink' && !light(groundOf(cell))
    const state = Object.keys(states).find((c) => cell.classList.contains(c))
    const want = state ? states[state] : onInk ? paper : ink
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const
    const off = sides.filter((side) => {
      const width = Number.parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`))
      const style = s.getPropertyValue(`border-${side.toLowerCase()}-style`)
      const colour = s.getPropertyValue(`border-${side.toLowerCase()}-color`)
      return Math.abs(width - 1) > 0.01 || style !== 'solid' || colour !== want
    })
    if (off.length > 0) {
      const side = off[0]?.toLowerCase() ?? 'top'
      out.push(
        `frame: ${what} ${off.join('/').toLowerCase()} is ` +
          `${s.getPropertyValue(`border-${side}-width`)} ${s.getPropertyValue(`border-${side}-style`)} ` +
          `${s.getPropertyValue(`border-${side}-color`)}, not 1px solid ${want}`
      )
    }
  }

  // §7.2: every border-riding stamp.
  for (const stamp of document.querySelectorAll('.su-stamp-seam')) {
    if (!visible(stamp)) continue
    seams++
    // The box it rides: its containing block (`.su-stamp-seam` is absolute).
    const box = (stamp as HTMLElement).offsetParent ?? stamp.parentElement
    if (!box) continue
    const borderTop = (el: Element) => Number.parseFloat(getComputedStyle(el).borderTopWidth) || 0
    let frame: Element | null = borderTop(box) > 0 ? box : null
    if (!frame) {
      for (const el of box.querySelectorAll('*')) {
        if (stamp.contains(el) || el.closest('.su-stamp-seam')) continue
        if (borderTop(el) > 0 && visible(el)) {
          frame = el
          break
        }
      }
    }
    const what = `"${text(stamp)}"`
    if (!frame) {
      out.push(`seam: ${what} rides no bordered frame`)
      continue
    }
    const r = stamp.getBoundingClientRect()
    const f = frame.getBoundingClientRect()
    const line = f.top + borderTop(frame) / 2
    const centre = r.top + r.height / 2
    const delta = centre - line
    if (Math.abs(delta) > tolerance) {
      out.push(
        `seam: ${what} centres ${delta.toFixed(1)}px off its frame's border line ` +
          `(${frame.tagName.toLowerCase()}${frame.classList[0] ? `.${frame.classList[0]}` : ''})`
      )
    }
  }
  return { faults: out, cells, seams }
}

/**
 * Every §7 fault on the page as it stands, one line each, and how many value
 * cells and seam stamps it read (a gate that read none proves nothing).
 */
export async function findValueCellFaults(
  page: Page
): Promise<{ faults: string[]; cells: number; seams: number }> {
  const found = await page.evaluate(scan, SEAM_TOLERANCE)
  return { ...found, faults: [...new Set(found.faults)] }
}
