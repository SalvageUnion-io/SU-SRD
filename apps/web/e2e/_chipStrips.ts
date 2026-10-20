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
 *   not on its lowest line and rightmost there; followed by +MORE alone, not
 *   right before it there.
 * - **fill** THE BOTTOM-RIGHT FILL of every head whose name and chips share
 *   a line (`[data-chip-fill]`: a Row's or Card's heading, a Tile's band, a
 *   Page's chapter band and its controls; owner's rule, 2026-10-20): its last
 *   item (the cost, the action) on the name's line and rightmost there. A
 *   head the fill never measured (no `data-fill-item`) fails too.
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
 * - **lines** a header-only Token's chips on more than one line (C5).
 * - **more** a +MORE chip that is not its strip's last chip, at the end of its
 *   lowest line (the visual bottom), or one that dropped the strip's cost (C5).
 *
 * Hard rule R37 (C2b, C5; owner's rule, 2026-10-20), every one failing:
 *
 * - **taller** a head whose chips make it taller: laid on one line beside its
 *   name (the name held at its width, so its own wrap is not counted), the
 *   head is shorter than as drawn. A fill head's and a contentful Token's.
 * - **overflow** a head whose chips rose above its name (a line over the
 *   name's line in a fill head, a contentful Token's chips on two lines), and
 *   a body's overflow row (`[data-chip-overflow]`) that is not its body's
 *   first row (right under its head, or first in a Token's body), not
 *   left-aligned, or holds the cost or the Tech Level.
 * - **more-contentful** a +MORE on a contentful rendering (a contentful
 *   Token, a head with an overflow row): its overflow is its body's first row.
 *
 * Reported and not failed while its entry stands in `_pendingRules.ts`:
 *
 * - **align** a head's name not at its left: room before it, on its line,
 *   that nothing (the art, the tier) fills (EDL E22).
 */
const STRIP = [
  '.su-entity-stamps',
  '[data-chip-group]',
  '[data-chip-overflow]',
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

/** A contentful Token (N3), and a header-only head's +MORE (C5): its strip's last chip. */
const CONTENTFUL = '.su-entity-token[data-contentful]'
const MORE = '.su-chip-more'

/** A head that fills from its bottom-right corner (`components/atoms/chipFill.ts`). */
const FILL = '[data-chip-fill]'

/** A body's first row, holding what of its head's chips did not fit beside the name (C2b). */
const OVERFLOW = '[data-chip-overflow]'

/** The band a contentful head's overflow row follows. */
const OVERFLOW_OWNER = '[data-chip-overflow-owner]'

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
  fill,
  overflow,
  owner,
}: {
  strip: string
  chip: string
  classes: readonly string[]
  read: readonly string[]
  frame: string
  contentful: string
  more: string
  fill: string
  overflow: string
  owner: string
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
  /**
   * How much taller a head is as drawn than with its chips laid on one line
   * beside its name, the name held at its width (its own wrap is the name's,
   * not the chips'): the height its chips add by stacking. Measured by
   * laying it so for a moment and putting it back, before the next frame.
   */
  const growth = (head: HTMLElement, name: HTMLElement, strip?: HTMLElement | null) => {
    const drawn = head.getBoundingClientRect().height
    const width = name.getBoundingClientRect().width
    const saved = [head, name, strip].map((el) => el?.style.cssText ?? '')
    name.style.width = `${width}px`
    name.style.flex = 'none'
    head.style.flexWrap = 'nowrap'
    if (strip) strip.style.flexWrap = 'nowrap'
    const one = head.getBoundingClientRect().height
    ;[head, name, strip].forEach((el, i) => {
      if (el) el.style.cssText = saved[i] ?? ''
    })
    return drawn - one
  }
  const faults: string[] = []
  // FOOT: a foot band carries no chip.
  for (const foot of document.querySelectorAll('[data-foot-band]')) {
    const inside = [...foot.querySelectorAll(chip)].filter(visible)
    if (inside.length > 0) {
      faults.push(`foot: "${describe(inside[0] as Element)}" is a chip in a foot band`)
    }
  }
  // MORE: a header-only head's; never a contentful rendering's, whose
  // overflow is its body's first row.
  for (const el of document.querySelectorAll(more)) {
    if (!visible(el)) continue
    const band = el.closest(owner)
    const rowed = !!band && !!band.nextElementSibling?.matches(overflow)
    if (el.closest(contentful) || rowed) {
      faults.push(`more-contentful: "${describe(el)}" is a +MORE on a contentful head`)
    }
  }
  // OVERFLOW: a body's overflow row is its first row (right under its head's
  // band, or first in a Token's body), left-aligned, and never holds the cost
  // or the Tech Level, which stay in the head.
  for (const row of document.querySelectorAll(overflow)) {
    if (!visible(row)) continue
    const where = `${describe(row)}…`
    const drawn = [...(row.parentElement?.children ?? [])].filter(visible)
    const before = drawn[drawn.indexOf(row) - 1]
    if (before && !before.matches(owner)) {
      faults.push(`overflow: ${where} the overflow row is not its body's first`)
    }
    const kept = row.querySelector('.su-cost, .su-cost-edge, [data-chip-class="rank"]')
    if (kept && visible(kept)) {
      faults.push(`overflow: ${where} "${describe(kept)}" left the head`)
    }
    const items = [...row.querySelectorAll(chip)].filter(visible)
    const s = getComputedStyle(row)
    const left = row.getBoundingClientRect().left + Number.parseFloat(s.paddingLeft)
    const start = Math.min(...items.map((el) => el.getBoundingClientRect().left))
    if (items.length > 0 && start - left > 1) {
      faults.push(`overflow: ${where} starts ${Math.round(start - left)}px in, not left-aligned`)
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
    // A contentful Token's head strip; and a header-only head's +MORE, its
    // menu lane's last chip.
    const token = root.closest(`${contentful} > .su-entity-token__head`)?.parentElement
    const moreChip = chips.find((el) => el.matches(more))
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
      const plates = [...el.querySelectorAll('.su-stat-plate')].filter(visible)
      if (plates.length < 2) continue
      const sizes = new Set(plates.map((p) => getComputedStyle(p).fontSize))
      if (sizes.size > 1) faults.push(`size: "${describe(el)}" at ${[...sizes].join(' / ')}`)
    }

    const classOfEl = (el: Element) =>
      el.closest('[data-chip-class]')?.getAttribute('data-chip-class')

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

    // FLUSH: the lines end on one right edge, or start on one left edge. A
    // strip in a bottom-right fill shares its lines with the head's other
    // items (a band's action): the fill's own law holds them flush, below.
    if (lines.length > 1 && !root.closest(fill)) {
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

    // OVERFLOW: a contentful Token's head keeps one line; the rest is its body's (C2b).
    if (token && lines.length > 1) {
      faults.push(`overflow: ${where} its head's chips on ${lines.length} lines, not one`)
    }
    // LINES: a header-only Token's chips on one line (C5).
    if (!token && root.closest('.su-entity-token__pill') && lines.length > 1) {
      faults.push(`lines: ${where} on ${lines.length} lines, at most 1`)
    }

    // MORE: +MORE is the strip's last chip, at the end of its lowest line
    // (the visual bottom: `lines` runs top to bottom on the page).
    const lowest = lines[lines.length - 1] as Box[]
    if (moreChip) {
      if ((lowest[lowest.length - 1] as Box).el !== moreChip) {
        faults.push(`more: ${where} "${describe(moreChip)}" is not at the end of its last line`)
      }
      // +MORE drops chips before the cost, never the cost (C2, C5).
      if (root.querySelector('[data-fill-out] .su-cost, [data-fill-out].su-cost-edge')) {
        faults.push(`more: ${where} "${describe(moreChip)}" dropped the cost`)
      }
    }

    // COST: the last read chip in the source (C2: the slots, a state, uses,
    // the menu, may follow it, C8); last of all, on the lowest line,
    // rightmost there; with +MORE after it, right before +MORE there.
    const cost = chips.find((el) => el.matches('.su-cost, .su-cost-edge'))
    if (cost) {
      const readChips = chips.filter((el) => read.includes(classOf(el)) || classOf(el) === '')
      const last = chips[chips.length - 1]
      const corner = (lowest[lowest.length - 1] as Box).el
      const beforeMore = lowest[lowest.length - 2]?.el
      if (readChips[readChips.length - 1] !== cost) {
        faults.push(`cost: ${where} "${describe(cost)}" is not the last read chip`)
      } else if (last === cost && corner !== cost) {
        faults.push(`cost: ${where} "${describe(cost)}" is not at the bottom-right`)
      } else if (moreChip && chips[chips.length - 2] === cost && beforeMore !== cost) {
        faults.push(
          `cost: ${where} "${describe(cost)}" is not right before +MORE at the bottom-right`
        )
      }
    }
  }
  // THE BOTTOM-RIGHT FILL: every head whose name and chips share one flow.
  for (const head of document.querySelectorAll<HTMLElement>(fill)) {
    const name = head.querySelector<HTMLElement>(':scope > [data-fill-name]')
    if (!name || !visible(name)) continue
    const items = [...head.querySelectorAll('[data-fill-item]')].filter(visible)
    const where = `${describe(name)}…`
    const nameBox = name.getBoundingClientRect()
    // ALIGN: the name sits at its head's left; only what draws there (the
    // art, the tier) may stand before it on its line.
    {
      const hs = getComputedStyle(head)
      const gap = Number.parseFloat(hs.columnGap) || 0
      let edge = head.getBoundingClientRect().left + Number.parseFloat(hs.paddingLeft)
      for (const el of head.querySelectorAll('*')) {
        if (el === name || name.contains(el) || el.contains(name) || !visible(el)) continue
        const b = el.getBoundingClientRect()
        const beside = Math.min(b.bottom, nameBox.bottom) - Math.max(b.top, nameBox.top) > 0
        if (beside && b.right <= nameBox.left + 1) edge = Math.max(edge, b.right + gap)
      }
      if (nameBox.left - edge > 2) {
        faults.push(
          `align: ${where} the name starts ${Math.round(nameBox.left - edge)}px from its head's left`
        )
      }
    }
    if (items.length === 0) {
      const drawn = [...head.querySelectorAll(chip)].some(visible)
      if (drawn) faults.push(`fill: ${where} its chips were never fitted (no data-fill-item)`)
      continue
    }
    const box = (el: Element) => el.getBoundingClientRect()
    // Lines: items whose boxes overlap vertically by half the shorter one;
    // the name's line is the one that overlaps the name's lower half.
    const lines: Element[][] = []
    for (const el of items) {
      const b = box(el)
      const line = lines.find((l) =>
        l.some((o) => {
          const a = box(o)
          return (
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >=
            Math.min(a.height, b.height) / 2
          )
        })
      )
      if (line) line.push(el)
      else lines.push([el])
    }
    for (const line of lines) line.sort((a, b) => box(a).left - box(b).left)
    lines.sort((a, b) => box(a[0] as Element).top - box(b[0] as Element).top)
    const onName = (el: Element) => {
      const b = box(el)
      const mid = (b.top + b.bottom) / 2
      return mid > nameBox.top && mid < nameBox.bottom + 1
    }
    const corner = items[items.length - 1] as Element
    // On a phone an index's search and filters follow its title, under the
    // band on the page ground (owner's call 2026-10-20); a show page's stamps
    // fill beside the title as every head's do.
    if (
      head.matches('.su-chapter-band__row') &&
      head.closest('[data-aside="controls"]') &&
      window.innerWidth < 640
    ) {
      const above = items.find((el) => box(el).top < nameBox.bottom - 1)
      if (above) faults.push(`fill: ${where} "${describe(above)}" is not under the title`)
      continue
    }
    const nameLine = lines.find((l) => l.some(onName))
    // OVERFLOW: nothing rises above the name's line (C2b).
    const risen = nameLine ? lines.slice(0, lines.indexOf(nameLine)).flat() : []
    if (risen.length > 0) {
      faults.push(`overflow: ${where} "${describe(risen[0] as Element)}" rose above the name`)
    }
    if (!nameLine || !onName(corner) || nameLine[nameLine.length - 1] !== corner) {
      faults.push(
        `fill: ${where} "${describe(corner)}" is not at the bottom right, on the name's line`
      )
      continue
    }
    // TALLER: its chips never make the head taller (C2b).
    const grew = growth(head, name)
    if (grew > 1) {
      faults.push(`taller: ${where} its chips make its head ${Math.round(grew)}px taller`)
    }
  }
  // TALLER: nor a contentful Token's head.
  for (const token of document.querySelectorAll(contentful)) {
    const pill = token.querySelector<HTMLElement>(
      ':scope > .su-entity-token__head .su-entity-token__pill'
    )
    const name = pill?.querySelector<HTMLElement>('.su-entity-token__notch')
    if (!pill || !name || !visible(pill)) continue
    const grew = growth(pill, name, pill.querySelector<HTMLElement>('.su-entity-token__chips'))
    if (grew > 1) {
      faults.push(`taller: ${describe(name)}… its chips make its head ${Math.round(grew)}px taller`)
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
    fill: FILL,
    overflow: OVERFLOW,
    owner: OVERFLOW_OWNER,
  })
}
