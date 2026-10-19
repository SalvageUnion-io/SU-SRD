import type { Page } from '@playwright/test'
import { CHIP_CLASSES } from '../src/components/entity/parts/chipSet'

/** The read chips, mark through the cost: no read chip follows the cost (C2). */
const READ_CHIP_CLASSES = CHIP_CLASSES.slice(0, CHIP_CLASSES.indexOf('cost') + 1)

/**
 * The chip-strip law (ruleset §4.7) as the rendered page draws it. A STRIP is
 * an entity's chip group: a Page's band cluster (`.su-entity-stamps`), a
 * card's or Row's head (`[data-chip-group]`), an index Tile's, a Token's. Its CHIPS are the
 * outermost `CHIP` elements inside it. `findChipStripFaults` returns one line
 * per fault:
 *
 * - **size** a chip whose value plate's type size is not its label's.
 * - **gap** a strip whose neighbouring chips on a line are not one gap apart
 *   (a stretched chip, a hole).
 * - **flush** a strip whose lines share neither a right edge nor a left one.
 * - **cost** a cost that is not the strip's last read chip, or, last of all,
 *   not on its lowest line and rightmost there.
 * - **unclassed** a chip in no class lane: the strip is not drawn by `Chips`
 *   (`chips-and-actions.md` C2a, hard rule R4).
 * - **order** a chip whose class comes before the one ahead of it: the strip
 *   goes back in the class order (C2: mark, rank, measure, economy, traits,
 *   relation, cost; then state, uses, menu), so a read chip follows the cost.
 * - **foot** a chip in a foot band (`[data-foot-band]`): a foot is text.
 */
const STRIP = [
  '.su-entity-stamps',
  '[data-chip-group]',
  '.su-entity-tile__chips',
  '.su-entity-token__chips',
].join(',')

const CHIP = [
  '.su-stat-cell',
  '.su-stat-column__cell',
  '.su-badge-stamp',
  '.su-chip-link',
  '.su-cost-edge',
  '.su-cost',
].join(',')

/** Runs in the page; returns plain data. */
function scan({
  strip,
  chip,
  classes,
  read,
}: {
  strip: string
  chip: string
  classes: readonly string[]
  read: readonly string[]
}): string[] {
  type Box = { el: Element; x: number; y: number; w: number; h: number }
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const describe = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const faults: string[] = []
  // FOOT: a foot band carries no chip.
  for (const foot of document.querySelectorAll('[data-foot-band]')) {
    const inside = [...foot.querySelectorAll(chip)].filter(visible)
    if (inside.length > 0) {
      faults.push(`foot: "${describe(inside[0] as Element)}" is a chip in a foot band`)
    }
  }
  const roots = [...document.querySelectorAll(strip)].filter(
    // A strip inside another is the outer one's (a band's Tag in its cluster).
    (root) => !root.parentElement?.closest(strip)
  )
  for (const root of roots) {
    const inside = [...root.querySelectorAll(chip)].filter(visible)
    const set = new Set(inside)
    const chips = inside.filter((el) => {
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (set.has(p)) return false
      }
      return true
    })
    if (chips.length === 0) continue
    const where = `${describe(chips[0] as Element)}…`

    // UNCLASSED and ORDER: each chip in its class's lane, the lanes in the
    // class order, in the source (what a screen reader reads).
    const classOf = (el: Element) => {
      const lane = el.closest('[data-chip-class]')
      return lane && root.contains(lane) ? (lane.getAttribute('data-chip-class') ?? '') : ''
    }
    let ahead = -1
    let aheadName = ''
    for (const el of chips) {
      const cls = classOf(el)
      const at = classes.indexOf(cls)
      if (at < 0) {
        faults.push(`unclassed: ${where} "${describe(el)}" is in no class lane`)
        continue
      }
      if (at < ahead) {
        faults.push(`order: ${where} "${describe(el)}" (${cls}) follows a ${aheadName} chip`)
      }
      if (at >= ahead) {
        ahead = at
        aheadName = cls
      }
    }

    // SIZE: a two-plate chip's label and value at one type size.
    for (const el of chips) {
      const plates = [...el.querySelectorAll('.su-stat-plate, dt, dd')].filter(visible)
      if (plates.length < 2) continue
      const sizes = new Set(plates.map((p) => getComputedStyle(p).fontSize))
      if (sizes.size > 1) faults.push(`size: "${describe(el)}" at ${[...sizes].join(' / ')}`)
    }

    // LINES: chips whose boxes overlap vertically by half the shorter one.
    const boxes: Box[] = chips.map((el) => {
      const r = el.getBoundingClientRect()
      return { el, x: r.left, y: r.top, w: r.width, h: r.height }
    })
    const lines: Box[][] = []
    for (const b of boxes) {
      const line = lines.find((l) =>
        l.some((o) => Math.min(o.y + o.h, b.y + b.h) - Math.max(o.y, b.y) >= Math.min(o.h, b.h) / 2)
      )
      if (line) line.push(b)
      else lines.push([b])
    }
    for (const line of lines) line.sort((a, b) => a.x - b.x)
    lines.sort((a, b) => (a[0] as Box).y - (b[0] as Box).y)

    // GAP: every neighbouring pair in the strip one gap apart.
    const gaps = lines.flatMap((line) =>
      line.slice(1).map((b, i) => Math.round(b.x - ((line[i] as Box).x + (line[i] as Box).w)))
    )
    if (gaps.length > 0 && Math.max(...gaps) - Math.min(...gaps) > 1) {
      faults.push(`gap: ${where} gaps ${gaps.join(',')}px`)
    }

    // FLUSH: the lines end on one right edge, or start on one left edge.
    if (lines.length > 1) {
      const rights = lines.map((l) => Math.round(Math.max(...l.map((b) => b.x + b.w))))
      const lefts = lines.map((l) => Math.round(Math.min(...l.map((b) => b.x))))
      const even = (xs: number[]) => Math.max(...xs) - Math.min(...xs) <= 1
      if (!even(rights) && !even(lefts)) {
        faults.push(`flush: ${where} lines end at ${rights.join(',')}, start at ${lefts.join(',')}`)
      }
    }

    // COST: the last read chip in the source (C2: the slots, a state, uses,
    // the menu, may follow it, C8); last of all, on the lowest line,
    // rightmost there.
    const cost = chips.find((el) => el.matches('.su-cost, .su-cost-edge'))
    if (cost) {
      const readChips = chips.filter((el) => read.includes(classOf(el)) || classOf(el) === '')
      const last = chips[chips.length - 1]
      const lowest = lines[lines.length - 1] as Box[]
      const corner = (lowest[lowest.length - 1] as Box).el
      if (readChips[readChips.length - 1] !== cost) {
        faults.push(`cost: ${where} "${describe(cost)}" is not the last read chip`)
      } else if (last === cost && corner !== cost) {
        faults.push(`cost: ${where} "${describe(cost)}" is not at the bottom-right`)
      }
    }
  }
  return faults
}

/** Every chip-strip fault on the page as it stands. */
export async function findChipStripFaults(page: Page): Promise<string[]> {
  return page.evaluate(scan, {
    strip: STRIP,
    chip: CHIP,
    classes: CHIP_CLASSES,
    read: READ_CHIP_CLASSES,
  })
}
