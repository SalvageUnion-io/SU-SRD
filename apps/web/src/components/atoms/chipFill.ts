/**
 * THE BOTTOM-RIGHT FILL (ruleset §4.7, `chips-and-actions.md` C2b; owner's
 * rule, 2026-10-20): a head's chips sit only beside its name, on the name's
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

/** A head that fills from its bottom-right corner: the flow's container. */
const FILL_HEAD = '[data-chip-fill]'

/** Its name (the cut-out, the title's plate): the bottom line's left end. */
const FILL_NAME = '[data-fill-name]'

/** Nodes beside a chip that are no chip: an open menu's focus guards and portal owner. */
const NOT_ITEMS = ['data-base-ui-focus-guard', 'data-base-ui-portal', 'aria-owns']

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
      if (NOT_ITEMS.some((attr) => child.hasAttribute(attr))) continue
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
 * The class that stays ahead of the rest (C2b; owner, 2026-10-20: "TL and
 * Slots should be in the header, others should flow beneath"): the
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
    // As many as fit stay (owner, 2026-10-20: "one of these could have fit in
    // the header"): one too wide leaves, and the next one in still may stay.
    if (fits(used + gap + width)) used += gap + width
    else out[i] = true
  }
  return { out, more: more !== undefined && out.some(Boolean) }
}

/** What a control's copy would lose: its handlers. A link or a stamp copies whole. */
const LIVE_CONTROL =
  'button, input, select, textarea, [role="radio"], [role="tab"], [role="switch"]'

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
  if (!unclassed.some((u, i) => u && !plan.out[i])) return plan
  if (kept + Math.max(oneLineWidth(name, 'min-content'), widestWord(name)) <= room - 1) return plan
  return overflowPlan(
    widths,
    items.map((item, i) => !unclassed[i] && isKept(item, container)),
    nameWidth,
    room,
    gap,
    moreWidth,
    first
  )
}

/** What each overflow row last drew: the items it copies, so an unchanged fit writes nothing. */
const drawnRow = new WeakMap<HTMLElement, readonly HTMLElement[]>()

/** The attributes a fit writes on an item, cleared from its copy. */
const FIT_ATTRIBUTES = ['data-fill-item', 'data-fill-line', 'data-fill-corner', OUT_ATTRIBUTE]

/**
 * Lay what left a contentful head in its body's first row (C2b): a copy of
 * each item that is out, in class order, each in a lane of its class (C2a),
 * so the row reads as a strip of its own; hidden while nothing is out. The
 * copies carry no ids, and nothing a fit wrote: what they link or Peek is
 * the document's (a link, the Peek's attributes), so they work as the chip.
 */
export function writeOverflowRow(row: HTMLElement, out: readonly HTMLElement[]): void {
  const drawn = drawnRow.get(row)
  if (drawn && drawn.length === out.length && drawn.every((item, i) => item === out[i])) {
    row.hidden = out.length === 0
    return
  }
  drawnRow.set(row, [...out])
  const lanes: HTMLElement[] = []
  for (const item of out) {
    const cls = item.closest('[data-chip-class]')?.getAttribute('data-chip-class') ?? ''
    let lane = lanes[lanes.length - 1]
    if (!lane || lane.getAttribute('data-chip-class') !== cls) {
      lane = document.createElement('span')
      lane.className = 'su-chip-lane'
      lane.setAttribute('data-chip-class', cls)
      lanes.push(lane)
    }
    const copy = item.cloneNode(true) as HTMLElement
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      el.removeAttribute('id')
      for (const attr of FIT_ATTRIBUTES) el.removeAttribute(attr)
      el.style?.removeProperty('--su-fill')
      el.style?.removeProperty('--su-corner-max')
    }
    lane.append(copy)
  }
  row.replaceChildren(...lanes)
  row.hidden = out.length === 0
}

/** What each head's last fit read (`fitChipFill`). */
const fittedAt = new WeakMap<HTMLElement, { at: string; out: boolean[]; more: boolean }>()

/** An item of the flow, marked so CSS orders it by its place from the end. */
const ITEM_ATTRIBUTE = 'data-fill-item'
/** An item on the name's line (a band centres those on its title's capitals). */
const LINE_ATTRIBUTE = 'data-fill-line'
/** The corner chip, wrapping its value: too wide for the line beside the name's longest word. */
const CORNER_ATTRIBUTE = 'data-fill-corner'

/**
 * Fit one head now: each item's place from the flow's end (`--su-fill`, on
 * every item: a chip, a label, a band's control), and which stay beside its
 * name, the rest out: into its body's overflow row, or behind +MORE.
 */
function fitChipFill(container: HTMLElement): void {
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
  const nameWidth = oneLineWidth(name)
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
  const wraps = shown.length > 0 && nameWidth + chipsWidth > room - 1
  const corner = shown[shown.length - 1]
  const last = shownWidths[shownWidths.length - 1] ?? 0
  // The name keeps its widest word whole where the corner chip can wrap its
  // value into what is left; a live control there (a sheet band's Pilot |
  // Mech | Crawler) cannot, and would be drawn over the name.
  const cornerWraps =
    !!corner && !corner.matches(LIVE_CONTROL) && !corner.querySelector(LIVE_CONTROL)
  const shortest = wraps
    ? Math.max(oneLineWidth(name, 'min-content'), cornerWraps ? widestWord(name) : 0)
    : 0
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

const watched = new WeakSet<HTMLElement>()
/** Every watched head, and its fit. */
const live = new Map<HTMLElement, (head: HTMLElement) => void>()
let fontsWatched = false

/** A face loads when text first uses it: every chip's width changes, so fit again. */
function watchFonts(): void {
  if (fontsWatched || typeof document === 'undefined' || !document.fonts) return
  fontsWatched = true
  const refit = () => fitInTurns([...live.keys()], (head) => live.get(head)?.(head))
  void document.fonts.ready.then(refit)
  document.fonts.addEventListener?.('loadingdone', refit)
}

/**
 * Fit a head (with `fit`, a fill head's by default; a contentful Mini's is
 * `chipFit.ts`'s) now and whenever its width, its name's or a chip's changes
 * (a resize, a face loading, a live reading) or its chips change; returns the
 * stop. A fit that reads what the last one read writes nothing, so the
 * resizes its own writes cause end there.
 */
export function watchChipFill(
  container: HTMLElement,
  fitOne: (head: HTMLElement) => void = fitChipFill
): () => void {
  if (watched.has(container)) return () => undefined
  watched.add(container)
  live.set(container, fitOne)
  const resize =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          if (!container.isConnected) return stop()
          fit()
        })
  // What the observer watches: observing a box again reports it again, and
  // that report fits again, so only a box new to the flow is observed (and
  // one gone from it let go). Re-observing all of them on every fit kept a
  // page with many heads fitting every frame, never idle.
  const observed = new Set<Element>()
  const fit = () => {
    fitOne(container)
    if (!resize) return
    const name = container.querySelector(`:scope > ${FILL_NAME}`)
    const now = new Set<Element>([container, ...container.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)])
    if (name) now.add(name)
    for (const el of observed) {
      if (now.has(el)) continue
      resize.unobserve(el)
      observed.delete(el)
    }
    for (const el of now) {
      if (observed.has(el)) continue
      resize.observe(el)
      observed.add(el)
    }
  }
  // The set of chips changes (a menu's slot, a chip added).
  const mutation = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(fit)
  const stop = () => {
    watched.delete(container)
    live.delete(container)
    resize?.disconnect()
    mutation?.disconnect()
  }
  fit()
  watchFonts()
  mutation?.observe(container, { childList: true, subtree: true, characterData: true })
  return stop
}

/** How many heads one task fits: a page of Compacts fitted at once is a long task. */
const TURN = 12

/**
 * Do `each` to many heads a turn at a time: those on screen first, now (a
 * shift in view counts against the page, one off screen does not), the rest
 * in tasks of `TURN`, so the main thread is never held long (TBT).
 */
function fitInTurns(containers: HTMLElement[], each: (head: HTMLElement) => void): void {
  if (containers.length <= TURN || typeof setTimeout === 'undefined') {
    for (const head of containers) each(head)
    return
  }
  const height = typeof innerHeight === 'number' ? innerHeight : 0
  const later: HTMLElement[] = []
  for (const head of containers) {
    const r = head.getBoundingClientRect()
    if (r.bottom > 0 && r.top < height) each(head)
    else later.push(head)
  }
  const next = () => {
    for (const head of later.splice(0, TURN)) if (head.isConnected) each(head)
    if (later.length > 0) setTimeout(next, 0)
  }
  if (later.length > 0) setTimeout(next, 0)
}

/**
 * A static page's heads (server-rendered, no React) that `selector` finds:
 * each fits with `fit` (in turns) and on resize. A fill head's by default.
 */
export function watchStaticChipFill(
  root: ParentNode = document,
  selector = FILL_HEAD,
  fit: (head: HTMLElement) => void = fitChipFill
): void {
  fitInTurns([...root.querySelectorAll<HTMLElement>(selector)], (head) => {
    watchChipFill(head, fit)
  })
}
