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
 *   (a stretched chip, a hole); in a list's lanes (C6), within each lane.
 * - **flush** a strip whose lines share neither a right edge nor a left one.
 * - **cost** a cost that is not the strip's last read chip, or, last of all,
 *   not on its lowest line and rightmost there.
 * - **unclassed** a chip in no class lane: the strip is not drawn by `Chips`
 *   (`chips-and-actions.md` C2a, hard rule R4).
 * - **order** a chip whose class comes before the one ahead of it: the strip
 *   goes back in the class order (C2: mark, rank, measure, economy, traits,
 *   relation, cost; then state, uses, menu), so a read chip follows the cost.
 * - **foot** a chip in a foot band (`[data-foot-band]`): a foot is text.
 * - **clip** a chip not whole inside its strip's visible box (R3, C3, C5):
 *   the strip's own box, cut by its entity's frame and by every ancestor that
 *   hides its overflow. A chip past its Row's edge, or cut by a Token's pill,
 *   fails; only the name may give way.
 * - **lines** a header-only Token's chips on more than one line, a Row's
 *   or a contentful Token's (N3) on more than two (C5): past two a
 *   contentful Token draws the chips that fit and ends its second line in
 *   +MORE, which opens its Peek.
 * - **more** a +MORE chip anywhere but a contentful Token's strip, or one
 *   that is not its strip's last chip, at the end of its lowest line (C5).
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
  // An action chip in the group (C8): a Row's "⋯", and whatever fills its
  // last slot (a Row's Use, a host's controls; hard rule R6).
  '.su-header-menu-trigger--overflow',
  '[data-chip-class="menu"] > *',
  // A live sheet item's condition and uses stepper, in the state and uses
  // slots (C8, hard rule R6): each one chip.
  '[data-chip-class="state"] > .su-sheet-item__condition',
  '[data-chip-class="uses"] > *',
].join(',')

/** A contentful Token (N3) and its +MORE (C5): a button beside its head's link, on its strip. */
const CONTENTFUL = '.su-entity-token[data-contentful]'
const MORE = '.su-chip-more'

/** An entity's frame: the box no chip of its strips may leave. */
const FRAME = [
  '.su-entity-row__frame',
  '.su-entity-token__pill',
  '.su-entity-tile__frame',
  '.su-ec-frame',
].join(',')

/** Runs in the page; returns plain data. */
function scan({
  strip,
  chip,
  classes,
  read,
  frame,
  contentful,
  more,
}: {
  strip: string
  chip: string
  classes: readonly string[]
  read: readonly string[]
  frame: string
  contentful: string
  more: string
}): string[] {
  type Box = { el: Element; x: number; y: number; w: number; h: number }
  type Rect = { left: number; top: number; right: number; bottom: number }
  const cut = (a: Rect, b: Rect): Rect => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  })
  const clips = (value: string) => value === 'hidden' || value === 'clip'
  const scrolls = (value: string) => value === 'auto' || value === 'scroll'
  /**
   * What of the strip can be seen: its box (a `display: contents` group's is
   * its parent's), cut by its entity's frame and by each ancestor that hides
   * its overflow on an axis, up to the nearest scroller. A scroller hides
   * nothing for good (what it scrolls out of view, and what its own frame
   * clips there, is a scroll away), so the walk stops at it.
   */
  const visibleBox = (root: Element): Rect => {
    let own: Element = root
    while (getComputedStyle(own).display === 'contents' && own.parentElement) {
      own = own.parentElement
    }
    let box: Rect = own.getBoundingClientRect()
    const host = root.closest(frame)
    if (host) box = cut(box, host.getBoundingClientRect())
    for (let p = root.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (scrolls(s.overflowX) || scrolls(s.overflowY)) break
      const r = p.getBoundingClientRect()
      if (clips(s.overflowX))
        box = { ...box, left: Math.max(box.left, r.left), right: Math.min(box.right, r.right) }
      if (clips(s.overflowY))
        box = { ...box, top: Math.max(box.top, r.top), bottom: Math.min(box.bottom, r.bottom) }
    }
    return box
  }
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
  // MORE: only a contentful Token's strip ends in +MORE.
  for (const el of document.querySelectorAll(more)) {
    if (visible(el) && !el.closest(contentful)) {
      faults.push(`more: "${describe(el)}" is a +MORE outside a contentful Token`)
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
      // +MORE's slot is the room it lies on, not a chip (C5).
      if (el.matches('.su-chip-more-slot')) return false
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (set.has(p)) return false
      }
      return true
    })
    // A contentful Token's +MORE lies on its strip from beside its head:
    // the strip's last chip, in its menu slot.
    const token = root.closest(`${contentful} > .su-entity-token__head`)?.parentElement
    const moreChip = [...(token?.querySelectorAll(more) ?? [])].find(
      (el) => visible(el) && !root.contains(el)
    )
    if (moreChip) chips.push(moreChip)
    if (chips.length === 0) continue
    const where = `${describe(chips[0] as Element)}…`

    // UNCLASSED and ORDER: each chip in its class's lane, the lanes in the
    // class order, in the source (what a screen reader reads).
    const classOf = (el: Element) => {
      if (el === moreChip) return 'menu'
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

    const classOfEl = (el: Element) =>
      el === moreChip ? 'menu' : el.closest('[data-chip-class]')?.getAttribute('data-chip-class')

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

    // GAP: every neighbouring pair in the strip one gap apart. A list's line
    // in its lanes (C6: `[data-chip-lanes]`, its lanes boxes) leaves a cell
    // empty, or a shorter value room, by design: there the gap is the lane's,
    // between neighbours of one class.
    const laned =
      root.matches('[data-lanes]') &&
      !!root.closest('[data-chip-lanes]') &&
      [...root.children].some((lane) => getComputedStyle(lane).display !== 'contents')
    const gaps = lines.flatMap((line) =>
      line.slice(1).flatMap((b, i) => {
        const a = line[i] as Box
        if (laned && classOfEl(a.el) !== classOfEl(b.el)) return []
        return [Math.round(b.x - (a.x + a.w))]
      })
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

    // CLIP: every chip whole inside what of its strip can be seen (R3).
    const seen = visibleBox(root)
    for (const b of boxes) {
      const out =
        b.x < seen.left - 1 ||
        b.y < seen.top - 1 ||
        b.x + b.w > seen.right + 1 ||
        b.y + b.h > seen.bottom + 1
      if (out) {
        const edges = [b.x, b.y, b.x + b.w, b.y + b.h].map(Math.round).join(',')
        const room = [seen.left, seen.top, seen.right, seen.bottom].map(Math.round).join(',')
        faults.push(`clip: ${where} "${describe(b.el)}" at ${edges} outside ${room}`)
      }
    }

    // LINES: a Token's chips on one line, a Row's and a contentful Token's
    // on at most two (C5): past two, a contentful Token ends in +MORE.
    const most = token
      ? 2
      : root.closest('.su-entity-token__pill')
        ? 1
        : root.closest('.su-entity-row__head')
          ? 2
          : Number.POSITIVE_INFINITY
    if (lines.length > most) {
      const hint = moreChip ? '' : ', with no +MORE'
      faults.push(`lines: ${where} on ${lines.length} lines, at most ${most}${hint}`)
    }

    // MORE: +MORE is the strip's last chip, at the end of its lowest line.
    if (moreChip) {
      const lowest = lines[lines.length - 1] as Box[]
      if ((lowest[lowest.length - 1] as Box).el !== moreChip) {
        faults.push(`more: ${where} "${describe(moreChip)}" is not at the end of its last line`)
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
    frame: FRAME,
    contentful: CONTENTFUL,
    more: MORE,
  })
}
