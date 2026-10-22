/**
 * THE BOTTOM-RIGHT FILL (ruleset §4.7, `chips-and-actions.md` C2b, R37): a
 * head's chips sit only beside its name, on the name's
 * line, the last of them (the cost, the last slot) in its bottom-right
 * corner, filling that line leftward. They never make the head taller: what
 * does not fit beside the name leaves the head. On a contentful rendering (a
 * Compact with a body, a Card, a Page, a contentful Mini) it is drawn as its
 * body's first row (`[data-chip-overflow]`, left-aligned, in class order); on
 * a header-only one (a bodyless Compact, a CompactIndex with no lead) it ends the head in
 * a +MORE chip (`[data-chip-more]`), the cost right before it. The Tech
 * Level (rank), the cost and the slots after it (C8) never leave the head.
 *
 * Flex places a line's items in order, so CSS alone cannot keep the name on
 * the left and the cost at the right end of one line. The order does it: each
 * chip's `order` is its place from the end (`--su-fill`, three apart: `Chips`'
 * lanes count it in CSS, and this writes it on every item of the flow), the
 * name's comes right after the chips beside it (`--su-beside`). This measures
 * which fit, the name on its one line; what does not is out
 * (`data-fill-out`, not drawn in the head), and its copy is laid in the
 * body's overflow row. Where not even the kept chips fit beside the one-line
 * name, the name wraps to give them their room (`--su-name-basis`).
 *
 * Plain DOM, no React: a static page's client entry (`islands.client.ts`)
 * runs it, and `useChipFill` on the pages it draws. Until it has run (and
 * with no script) the CSS keeps every chip beside the name as the flex line
 * breaks them on a wide head (the cost alone beside it on a phone), so the
 * common head does not move when it does.
 */

import { writeOverflowRow } from './chipOverflowRow'

/** A head that fills from its bottom-right corner: the flow's container. */
export const FILL_HEAD = '[data-chip-fill]'

/** Its name (the cut-out, the title's plate): the bottom line's left end. */
export const FILL_NAME = '[data-fill-name]'

/** Nodes beside a chip that are no chip: an open menu's focus guards and portal owner. */
const NOT_CHIP_ATTRIBUTES = ['data-base-ui-focus-guard', 'data-base-ui-portal', 'aria-owns']

/** Whether a node in a chip row is one of Base UI's injected nodes rather than a chip. */
export function isNotChip(el: Element): boolean {
  return NOT_CHIP_ATTRIBUTES.some((attr) => el.hasAttribute(attr))
}

/** A header-only head's +MORE (C5): drawn once a chip is out, its last chip. */
const MORE_ATTRIBUTE = 'data-chip-more'

/**
 * A contentful head's band: the element its body's overflow row
 * (`[data-chip-overflow]`) follows, as its next sibling.
 */
const OVERFLOW_OWNER_ATTRIBUTE = 'data-chip-overflow-owner'

/** The overflow row of the head `container` fills: the next sibling of its band, if that is one. */
function overflowRowOf(container: HTMLElement): HTMLElement | null {
  const next = container.closest(`[${OVERFLOW_OWNER_ATTRIBUTE}]`)?.nextElementSibling
  return next instanceof HTMLElement && next.hasAttribute('data-chip-overflow') ? next : null
}

/** A chip that left the head: not drawn there (its copy is in the overflow row, or +MORE stands for it). */
export const OUT_ATTRIBUTE = 'data-fill-out'

/**
 * The classes that never leave the head (C2b): the rank (the Tech Level),
 * the cost and the slots after it (C8: state, uses, the menu). What is in no
 * class (a band's control, a Card's type stamp) stays too, unless the name
 * would break inside a word (`planWithRoom`).
 */
const KEPT_CLASSES = new Set(['rank', 'cost', 'state', 'uses', 'menu'])

/**
 * The flow's items besides the name, in source order: the container's
 * children, read through every box that draws none (`display: contents`: a
 * strip, its class lanes, a cost's edge), skipping what is not drawn.
 */
function fillItems(container: HTMLElement, name: Element | null): HTMLElement[] {
  const items: HTMLElement[] = []
  const take = (parent: Element) => {
    for (const child of parent.children) {
      if (child === name || !(child instanceof HTMLElement)) continue
      if (isNotChip(child)) continue
      const display = getComputedStyle(child).display
      if (display === 'none') continue
      if (display === 'contents') take(child)
      else items.push(child)
    }
  }
  take(container)
  return items
}

/**
 * The room an item takes on a line, with its side margins: its width, or for
 * one that grows into its line (an index's search, a spring) its flex basis,
 * the width flex breaks the line by.
 */
function outerWidth(el: HTMLElement, room: number): number {
  const s = getComputedStyle(el)
  let width = el.getBoundingClientRect().width
  if (Number.parseFloat(s.flexGrow) > 0) {
    const basis = s.flexBasis
    if (basis.endsWith('%')) width = (room * Number.parseFloat(basis)) / 100
    else if (basis.endsWith('px')) width = Number.parseFloat(basis)
  }
  return width + (Number.parseFloat(s.marginLeft) || 0) + (Number.parseFloat(s.marginRight) || 0)
}

/**
 * The name's width on one line, unwrapped (its max-content), or at its
 * longest word (`min-content`). Its own margin is the auto one that holds
 * the line's free room, so it is not counted.
 */
function oneLineWidth(
  el: HTMLElement,
  size: 'max-content' | 'min-content' = 'max-content'
): number {
  const { width, flex } = el.style
  el.style.width = size
  el.style.flex = 'none'
  const measured = el.getBoundingClientRect().width
  el.style.width = width
  el.style.flex = flex
  return measured
}

/**
 * The name's narrowest width that breaks no word: its widest word, with the
 * padding and borders between that word and the name's own edges. A name
 * that may break anywhere (`overflow-wrap: anywhere`, a CompactIndex's or a Page's
 * title) has a `min-content` of one letter, and a fit that squeezed it there
 * broke a title mid-word on a phone ("MAZON / A").
 */
function widestWord(el: HTMLElement): number {
  if (typeof document === 'undefined' || typeof document.createRange !== 'function') return 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let widest = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Words only a screen reader hears (a Page title's "(Chassis)") take no
    // room: measured, their clipped box broke a title that fit (Mazona).
    if (node.parentElement?.closest('.su-sr-only')) continue
    const text = node.textContent ?? ''
    let inset = 0
    for (let box = node.parentElement; box && box !== el.parentElement; box = box.parentElement) {
      const s = getComputedStyle(box)
      inset +=
        (Number.parseFloat(s.paddingLeft) || 0) +
        (Number.parseFloat(s.paddingRight) || 0) +
        (Number.parseFloat(s.borderLeftWidth) || 0) +
        (Number.parseFloat(s.borderRightWidth) || 0)
    }
    for (const match of text.matchAll(/\S+/g)) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      // A word broken over lines is several boxes: its width is their sum.
      let word = 0
      for (const box of range.getClientRects()) word += box.width
      widest = Math.max(widest, word + inset)
    }
  }
  return widest
}

/**
 * A name that ends in "…" short of room rather than wrap (a Compact's, a
 * catalog tile's: owner): its title, or the name itself, clips
 * with an ellipsis.
 */
function ellipsizes(name: HTMLElement): boolean {
  for (let el: Element | null = name; el; el = el.firstElementChild) {
    if (getComputedStyle(el).textOverflow === 'ellipsis') return true
  }
  return false
}

/**
 * The narrowest an ellipsizing name gets: half its line, or its longest word.
 * The word is read with the name unclipped: clipped, its "…" cut the word's
 * box short, so each fit read another width than the last and the chips
 * beside it left and came back, frame after frame (CLS on /abilities/).
 */
function clippedName(name: HTMLElement, fullName: number, room: number): number {
  const { width, flex } = name.style
  name.style.width = 'max-content'
  name.style.flex = 'none'
  const word = widestWord(name)
  name.style.width = width
  name.style.flex = flex
  return Math.min(fullName, Math.max(word, room / 2))
}

/** An item's chip class within `root`: its own, or its lane's; '' for none. */
function classOfItem(item: Element, root: Element): string {
  const lane = item.closest('[data-chip-class]')
  return lane && root.contains(lane) ? (lane.getAttribute('data-chip-class') ?? '') : ''
}

/** Whether an item never leaves its head (`KEPT_CLASSES`, or in no class). */
export function isKept(item: Element, root: Element): boolean {
  const cls = classOfItem(item, root)
  return cls === '' || KEPT_CLASSES.has(cls)
}

/**
 * The class that stays ahead of the rest (C2b, R37): the
 * measures (Slots, SP, HP) keep their place beside the Tech Level while
 * they fit, before the economy and the traits take what room is left. Not
 * kept: a measure that does not fit still leaves, so the head never grows.
 */
const FIRST_CLASS = 'measure'

/** Whether an item takes its place in the head before the rest (`FIRST_CLASS`). */
export function isFirst(item: Element, root: Element): boolean {
  return classOfItem(item, root) === FIRST_CLASS
}

/**
 * Which of `widths` (in source order) leave the head (C2b): none when every
 * one fits beside a name `name` wide in `room`, each `gap` apart, with a
 * pixel to spare. Otherwise the `kept` ones stay (with +MORE after them,
 * `more` wide, on a header-only head), then the `first` ones that fit, in
 * source order, and of the rest those that fit beside them stay, counted
 * from the end, each that does not fit leaving and the next still tried, so
 * the head holds as many as it can. `more` is whether +MORE is drawn: only
 * when a chip left.
 */
export function overflowPlan(
  widths: readonly number[],
  kept: readonly boolean[],
  name: number,
  room: number,
  gap: number,
  more?: number,
  first: readonly boolean[] = []
): { out: boolean[]; more: boolean } {
  const fits = (used: number) => used <= room - 1
  const all = widths.reduce((sum, width) => sum + gap + width, name)
  const out = widths.map(() => false)
  if (fits(all)) return { out, more: false }
  let used = widths.reduce((sum, width, i) => (kept[i] ? sum + gap + width : sum), name)
  if (more !== undefined) used += gap + more
  for (let i = 0; i < widths.length; i++) {
    if (kept[i] || !first[i]) continue
    const width = widths[i] as number
    if (fits(used + gap + width)) used += gap + width
    else out[i] = true
  }
  for (let i = widths.length - 1; i >= 0; i--) {
    if (kept[i] || first[i]) continue
    const width = widths[i] as number
    // As many as fit stay (R37): one too wide leaves, and the next one in
    // still may stay.
    if (fits(used + gap + width)) used += gap + width
    else out[i] = true
  }
  return { out, more: more !== undefined && out.some(Boolean) }
}

/** What a control's copy would lose: its handlers. A link or a stamp copies whole. */
const LIVE_CONTROL =
  'button, input, select, textarea, [role="radio"], [role="tab"], [role="switch"]'

/**
 * Whether an item's copy works as it once its buttons forward their clicks
 * (`writeOverflowRow`): its only live controls are plain buttons (a Tech
 * Level stepper's − and +), none a field, tab or switch.
 */
function forwards(item: HTMLElement): boolean {
  const live = [
    ...(item.matches(LIVE_CONTROL) ? [item] : []),
    ...item.querySelectorAll(LIVE_CONTROL),
  ]
  return live.every((el) => el.matches('button:not([role])'))
}

/** Whether an item's copy in the first row works as the item: a link, or nothing live. */
function copiesWhole(item: HTMLElement): boolean {
  // The owner vouches for its copy: a sheet's Pilot | Mech | Crawler links.
  if (item.hasAttribute('data-fill-copy') || item.querySelector('[data-fill-copy]')) return true
  if (item.matches('a[href]')) return !item.querySelector(LIVE_CONTROL)
  return !item.matches(LIVE_CONTROL) && !item.querySelector(LIVE_CONTROL)
}

/**
 * A head's plan (`overflowPlan`), the kept items staying. Where even they
 * leave the name less than its widest word (a Page's band on a phone: the
 * Tech Level and "Build with this" beside a one-word title) and the head has
 * a first row, its items in no class (a band's control, a Card's type stamp)
 * leave too, if their copy works as they do (a link, a stamp; never a live
 * control such as a sheet's Pilot | Mech | Crawler tabs): the name never
 * breaks inside a word and no item is squeezed past its own words. The rank,
 * the cost and C8's slots never leave.
 */
function planWithRoom(
  container: HTMLElement,
  name: HTMLElement,
  items: readonly HTMLElement[],
  widths: readonly number[],
  nameWidth: number,
  room: number,
  gap: number,
  moreWidth: number | undefined,
  hasRow: boolean
): { out: boolean[]; more: boolean } {
  const first = items.map((item) => isFirst(item, container))
  const plan = overflowPlan(
    widths,
    items.map((item) => isKept(item, container)),
    nameWidth,
    room,
    gap,
    moreWidth,
    first
  )
  if (!hasRow) return plan
  const kept = widths.reduce((sum, width, i) => (plan.out[i] ? sum : sum + gap + width), 0)
  const unclassed = items.map((item) => classOfItem(item, container) === '' && copiesWhole(item))
  const shortest = ellipsizes(name)
    ? nameWidth
    : Math.max(oneLineWidth(name, 'min-content'), widestWord(name))
  if (kept + shortest <= room - 1) return plan
  const freed = unclassed.some((u, i) => u && !plan.out[i])
    ? overflowPlan(
        widths,
        items.map((item, i) => !unclassed[i] && isKept(item, container)),
        nameWidth,
        room,
        gap,
        moreWidth,
        first
      )
    : plan
  // Where even then the name would break inside a word (a crawler's long
  // name in Edit on a phone, beside its Tech Level stepper and type), the
  // name takes the band's width and the rest are the first row, the Tech
  // Level too (R37); the cost and C8's slots stay.
  const left = widths.reduce((sum, width, i) => (freed.out[i] ? sum : sum + gap + width), 0)
  if (left + shortest <= room - 1) return freed
  const stays = items.map(
    (item, i) =>
      !freed.out[i] &&
      (CORNER_CLASSES.has(classOfItem(item, container)) || !(copiesWhole(item) || forwards(item)))
  )
  return { out: items.map((_, i) => !stays[i]), more: false }
}

/** What stays in the head however long its name: the cost and the slots after it (C8). */
const CORNER_CLASSES = new Set(['cost', 'state', 'uses', 'menu'])

/** What each head's last fit read (`fitChipFill`). */
const fittedAt = new WeakMap<HTMLElement, { at: string; out: boolean[]; more: boolean }>()

/** An item of the flow, marked so CSS orders it by its place from the end. */
export const ITEM_ATTRIBUTE = 'data-fill-item'
/** An item on the name's line (a band centres those on its title's capitals). */
const LINE_ATTRIBUTE = 'data-fill-line'
/** The corner chip, wrapping its value: too wide for the line beside the name's longest word. */
const CORNER_ATTRIBUTE = 'data-fill-corner'

/**
 * Fit one head now: each item's place from the flow's end (`--su-fill`, on
 * every item: a chip, a label, a band's control), and which stay beside its
 * name, the rest out: into its body's overflow row, or behind +MORE.
 */
export function fitChipFill(container: HTMLElement): void {
  const name = container.querySelector<HTMLElement>(`:scope > ${FILL_NAME}`)
  if (!name) return
  // An out item carries no item mark, so it is cleared by its own: left
  // hidden, it measured nothing on the next fit, which then kept it (still
  // hidden) and emptied the overflow row, losing the chip.
  for (const stale of container.querySelectorAll(`[${ITEM_ATTRIBUTE}], [${OUT_ATTRIBUTE}]`)) {
    stale.removeAttribute(ITEM_ATTRIBUTE)
    stale.removeAttribute(LINE_ATTRIBUTE)
    stale.removeAttribute(CORNER_ATTRIBUTE)
    stale.removeAttribute(OUT_ATTRIBUTE)
  }
  // Every chip drawn to be measured, +MORE too: the fit starts from them all.
  const more = container.querySelector<HTMLElement>(`[${MORE_ATTRIBUTE}]`)
  if (more) more.hidden = false
  const row = overflowRowOf(container)
  const all = fillItems(container, name)
  const moreItem = more ? all.find((item) => item === more || item.contains(more)) : undefined
  const items = all.filter((item) => item !== moreItem)
  const s = getComputedStyle(container)
  const room =
    container.clientWidth -
    (Number.parseFloat(s.paddingLeft) || 0) -
    (Number.parseFloat(s.paddingRight) || 0)
  const gap = Number.parseFloat(s.columnGap) || 0
  const widths = items.map((item) => outerWidth(item, room))
  const moreWidth = moreItem ? outerWidth(moreItem, room) : undefined
  // A name that ends in "…" gives way to its chips down to half its line (or
  // its longest word, if wider): the chips stay beside it and it clips (R3:
  // a chip is never cut, only the name flexes); past that they go out.
  const fullName = oneLineWidth(name)
  const nameWidth = ellipsizes(name) ? clippedName(name, fullName, room) : fullName
  // A head laid by CSS alone (a Page's controls band on a phone, its
  // controls over its title) sends nothing out; nor does one with nowhere to send it.
  // Nor does one not laid out (a closed tab): it fits once drawn.
  const routes = room > 0 && s.flexDirection === 'row-reverse' && (!!row || moreWidth !== undefined)
  // What this fit reads: the same again (its own writes resized the name or
  // a line), and nothing changes.
  const at = [room, gap, nameWidth, moreWidth ?? -1, ...widths].map((n) => n.toFixed(2)).join(',')
  const fitted = fittedAt.get(container)
  const plan =
    fitted?.at === at
      ? fitted
      : routes
        ? planWithRoom(container, name, items, widths, nameWidth, room, gap, moreWidth, !!row)
        : { out: items.map(() => false), more: false }
  items.forEach((item, i) => {
    if (plan.out[i]) item.setAttribute(OUT_ATTRIBUTE, '')
  })
  if (more) more.hidden = !plan.more
  if (row) writeOverflowRow(row, routes ? items.filter((_, i) => plan.out[i]) : [])
  const shown = [
    ...items.filter((_, i) => !plan.out[i]),
    ...(plan.more && moreItem ? [moreItem] : []),
  ]
  shown.forEach((item, index) => {
    item.setAttribute(ITEM_ATTRIBUTE, '')
    item.setAttribute(LINE_ATTRIBUTE, '')
    item.style.setProperty('--su-fill', String(shown.length - index))
  })
  const shownWidths = shown.map((item) =>
    item === moreItem ? (moreWidth as number) : (widths[items.indexOf(item)] as number)
  )
  const chipsWidth = shownWidths.reduce((sum, width) => sum + gap + width, 0)
  // The chips beside the one-line name: where even they do not fit, the name
  // wraps in the room they leave, and where its longest word leaves too
  // little, the corner chip wraps its value in what is left (E18: it wraps,
  // never clipped).
  const wraps = shown.length > 0 && fullName + chipsWidth > room - 1
  const corner = shown[shown.length - 1]
  const last = shownWidths[shownWidths.length - 1] ?? 0
  // The name keeps its widest word whole where the corner chip can wrap its
  // value into what is left; a live control there (a sheet band's Pilot |
  // Mech | Crawler) cannot, and would be drawn over the name.
  const cornerWraps =
    !!corner && !corner.matches(LIVE_CONTROL) && !corner.querySelector(LIVE_CONTROL)
  // A name that ends in "…" gives the chips shown all they need (R3: a chip
  // is never cut, only the name flexes): the corner never wraps beside it.
  const clips = nameWidth < fullName || ellipsizes(name)
  const shortest = !wraps
    ? 0
    : clips
      ? 0
      : Math.max(oneLineWidth(name, 'min-content'), cornerWraps ? widestWord(name) : 0)
  const squeezed = wraps && room - chipsWidth - 1 < shortest
  if (corner && squeezed) corner.setAttribute(CORNER_ATTRIBUTE, '')
  if (fitted?.at === at) return
  fittedAt.set(container, { at, out: plan.out, more: plan.more })
  if (corner) {
    if (squeezed)
      corner.style.setProperty(
        '--su-corner-max',
        `${Math.max(0, room - (chipsWidth - last) - shortest - 1)}px`
      )
    else corner.style.removeProperty('--su-corner-max')
  }
  container.style.setProperty('--su-items', String(shown.length))
  container.style.setProperty('--su-beside', String(shown.length))
  container.style.setProperty(
    '--su-name-basis',
    wraps ? `${squeezed ? shortest : Math.max(0, room - chipsWidth - 1)}px` : 'auto'
  )
}
