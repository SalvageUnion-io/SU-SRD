/**
 * THE BOTTOM-RIGHT FILL (ruleset §4.7, `chips-and-actions.md` C2b): a head's
 * chips start on its name's line, at the bottom right, and fill that line
 * leftward, from the strip's end; only what overfills it rises to a line
 * above, and each line above fills from the right too. One flow, the name in
 * it: a Row's or Card's heading, a Tile's band, a Page's chapter band.
 *
 * Flex places a line's items in order and breaks greedily, so CSS alone cannot
 * keep the name on the bottom line and the cost at its right end. The order
 * does it: each chip's `order` is its place from the end (`--su-fill`, three
 * apart: `Chips`' lanes count it in CSS, and this writes it on every item
 * of the flow), the name's comes right after the chips that fit beside it
 * (`--su-beside`), and a break (the container's `::after`) right after the
 * name, so every chip past it rises. This measures how many fit, the name on
 * its one line; where not even the last one does, the name wraps to give it
 * its room (`--su-name-basis`), so the cost is always on the name's line.
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
 * How many of `widths` (in source order) fit beside a name `name` wide in
 * `room`, counted from the end, each `gap` apart, with a pixel to spare.
 */
export function besideCount(
  widths: readonly number[],
  name: number,
  room: number,
  gap: number
): number {
  let used = name
  let count = 0
  for (let i = widths.length - 1; i >= 0; i--) {
    const width = widths[i] as number
    // A pixel to spare: flex breaks the line at any overflow, and a name
    // that does not fit would wrap above its own chips.
    if (used + gap + width > room - 1) break
    used += gap + width
    count += 1
  }
  return count
}

/** What each head's last fit read (`fitChipFill`). */
const fittedAt = new WeakMap<HTMLElement, { at: string; beside: number }>()

/** An item of the flow, marked so CSS orders it by its place from the end. */
const ITEM_ATTRIBUTE = 'data-fill-item'
/** An item on the name's line (a band centres those on its title's capitals). */
const LINE_ATTRIBUTE = 'data-fill-line'
/** The corner chip, wrapping its value: too wide for the line beside the name's longest word. */
const CORNER_ATTRIBUTE = 'data-fill-corner'

/**
 * Fit one head now: each item's place from the flow's end (`--su-fill`, on
 * every item: a chip, a label, a band's control), and how many sit beside
 * its name, the rest rising.
 */
function fitChipFill(container: HTMLElement): void {
  const name = container.querySelector<HTMLElement>(`:scope > ${FILL_NAME}`)
  if (!name) return
  for (const stale of container.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)) {
    stale.removeAttribute(ITEM_ATTRIBUTE)
    stale.removeAttribute(LINE_ATTRIBUTE)
    stale.removeAttribute(CORNER_ATTRIBUTE)
  }
  const items = fillItems(container, name)
  items.forEach((item, index) => {
    item.setAttribute(ITEM_ATTRIBUTE, '')
    item.style.setProperty('--su-fill', String(items.length - index))
  })
  const s = getComputedStyle(container)
  const room =
    container.clientWidth -
    (Number.parseFloat(s.paddingLeft) || 0) -
    (Number.parseFloat(s.paddingRight) || 0)
  const gap = Number.parseFloat(s.columnGap) || 0
  const widths = items.map((item) => outerWidth(item, room))
  const nameWidth = oneLineWidth(name)
  // What this fit reads: the same again (its own writes resized the name or
  // a line), and nothing changes.
  const at = [room, gap, nameWidth, ...widths].map((n) => n.toFixed(2)).join(',')
  const last = widths[widths.length - 1]
  const fitted = fittedAt.get(container)
  const beside = fitted?.at === at ? fitted.beside : besideCount(widths, nameWidth, room, gap)
  const onLine = Math.max(beside, last === undefined ? 0 : 1)
  items.slice(items.length - onLine).forEach((item) => {
    item.setAttribute(LINE_ATTRIBUTE, '')
  })
  // Not even the last chip fits beside the one-line name: the name wraps in
  // the room it leaves, and where its longest word leaves too little, the
  // chip wraps its value in what is left (E18: it wraps, never clipped).
  const corner = items[items.length - 1]
  const shortest = beside === 0 && last !== undefined ? oneLineWidth(name, 'min-content') : 0
  const squeezed = beside === 0 && last !== undefined && room - gap - last - 1 < shortest
  if (corner && squeezed) corner.setAttribute(CORNER_ATTRIBUTE, '')
  if (fitted?.at === at) return
  fittedAt.set(container, { at, beside })
  if (corner) {
    if (squeezed)
      corner.style.setProperty('--su-corner-max', `${Math.max(0, room - gap - shortest - 1)}px`)
    else corner.style.removeProperty('--su-corner-max')
  }
  container.style.setProperty('--su-items', String(items.length))
  container.style.setProperty('--su-beside', String(onLine))
  container.style.setProperty(
    '--su-name-basis',
    beside === 0 && last !== undefined
      ? `${squeezed ? shortest : Math.max(0, room - gap - last - 1)}px`
      : 'auto'
  )
}

const watched = new WeakSet<HTMLElement>()
const live = new Set<HTMLElement>()
let fontsWatched = false

/** A face loads when text first uses it: every chip's width changes, so fit again. */
function watchFonts(): void {
  if (fontsWatched || typeof document === 'undefined' || !document.fonts) return
  fontsWatched = true
  const refit = () => fitInTurns([...live], fitChipFill)
  void document.fonts.ready.then(refit)
  document.fonts.addEventListener?.('loadingdone', refit)
}

/**
 * Fit a head now and whenever its width, its name's or a chip's changes (a
 * resize, a face loading, a live reading) or its chips change; returns the
 * stop. A fit that reads what the last one read writes nothing, so the
 * resizes its own writes cause end there.
 */
export function watchChipFill(container: HTMLElement): () => void {
  if (watched.has(container)) return () => undefined
  watched.add(container)
  live.add(container)
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
    fitChipFill(container)
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

/** How many heads one task fits: a page of Rows fitted at once is a long task. */
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

/** A static page's heads (server-rendered, no React): each fits (in turns) and on resize. */
export function watchStaticChipFill(root: ParentNode = document): void {
  fitInTurns([...root.querySelectorAll<HTMLElement>(FILL_HEAD)], (head) => {
    watchChipFill(head)
  })
}
