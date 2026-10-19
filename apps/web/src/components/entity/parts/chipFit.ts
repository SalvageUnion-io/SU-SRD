/**
 * The arithmetic of a wrapping chip strip, and the one place it is measured
 * by its own script: a contentful Token's +MORE (`chips-and-actions.md` C5).
 * Plain DOM, no React: the client entry (`islands.client.ts`) runs it on a
 * static page, and `Token` on the ones it draws.
 */

/** The chips' 2px side margins: the 4px gap between two on a line (`.su-chips`). */
const CHIP_GAP = 4

/**
 * The most lines a contentful Token's chips take beside its name (C5): past
 * that the second line ends in +MORE, which opens its Peek.
 */
export const MORE_LINES = 2

/**
 * How many lines `widths` take packed into `room` in the order given, each
 * chip whole, or `Infinity` when one chip is wider than the room. A strip
 * that fills bottom-heavy (from its bottom-right corner) packs from its end:
 * pass its widths reversed. Balancing evens the lines out; it never adds one.
 */
export function chipLines(widths: readonly number[], room: number, gap = CHIP_GAP): number {
  let lines = 0
  let used = 0
  for (const width of widths) {
    if (width > room + 0.5) return Number.POSITIVE_INFINITY
    if (lines === 0 || used + gap + width > room + 0.5) {
      lines += 1
      used = width
    } else used += gap + width
  }
  return lines
}

/**
 * How many of `widths` a contentful Token's strip shows from the front (C5).
 * Its chips fill bottom-heavy (owner, 2026-10-19): the last chip takes the
 * bottom-right corner and the lines pack from there, so they are counted from
 * the strip's end. Every chip shows when they take at most `lines` lines of
 * `room`. Past that +MORE (`more` wide) takes the corner after the last
 * `keep` chips (the cost and the slots after it, C2, C8), which always show:
 * the rest show from the front in class order, as many as take `lines` lines
 * with them, and the others are dropped whole from the end of that run,
 * never clipped. Returns how many of the first `widths.length - keep` show.
 */
export function moreFit(
  widths: readonly number[],
  more: number,
  room: number,
  {
    lines = MORE_LINES,
    gap = CHIP_GAP,
    keep = 0,
  }: { lines?: number; gap?: number; keep?: number } = {}
): number {
  const front = widths.length - keep
  const fromEnd = (xs: readonly number[]) => chipLines([...xs].reverse(), room, gap)
  if (fromEnd(widths) <= lines) return front
  const tail = widths.slice(front)
  for (let shown = front - 1; shown > 0; shown--) {
    if (fromEnd([...widths.slice(0, shown), ...tail, more]) <= lines) return shown
  }
  return 0
}

/** A contentful Token (N3), the one form whose chips may end in +MORE. */
const MORE_TOKEN = '.su-entity-token[data-contentful]'
/** Its +MORE: a Peek trigger beside its head, never inside its link. */
const MORE_CHIP = '.su-entity-token__more'
/** The room +MORE takes at the end of the strip's second line, in its last lane. */
const MORE_SLOT = '.su-chip-more-slot'
/** A chip past the two lines: not drawn (its Peek shows it). */
const OVER_ATTRIBUTE = 'data-chip-over'

/** A Token's strip, its +MORE and its slot, or nothing to fit. */
function partsOf(token: HTMLElement) {
  const strip = token.querySelector<HTMLElement>('.su-entity-token__chips')
  const more = token.querySelector<HTMLElement>(`:scope > ${MORE_CHIP}`)
  const slot = strip?.querySelector<HTMLElement>(MORE_SLOT)
  return strip && more && slot ? { strip, more, slot } : undefined
}

/**
 * The lanes whose chips +MORE never drops: the cost and the slots after it
 * (C2, C8), so the bottom line ends in the cost, then +MORE.
 */
const KEPT_LANES = new Set(['cost', 'state', 'uses', 'menu'])

/**
 * The strip's chips, in order: each lane's children (the lanes are
 * `display: contents`), and how many at the end are kept (`KEPT_LANES`).
 */
function chipsOf(strip: HTMLElement): { chips: HTMLElement[]; keep: number } {
  const chips: HTMLElement[] = []
  let keep = 0
  for (const lane of strip.children) {
    const kept = KEPT_LANES.has(lane.getAttribute('data-chip-class') ?? '')
    for (const chip of lane.children) {
      if (!(chip instanceof HTMLElement) || chip.matches(MORE_SLOT)) continue
      chips.push(chip)
      // A kept chip counts only after the last droppable one.
      keep = kept ? keep + 1 : 0
    }
  }
  return { chips, keep }
}

/** How many lines the drawn chips take: their distinct tops. */
function linesOf(chips: readonly HTMLElement[]): number {
  const tops: number[] = []
  for (const chip of chips) {
    const r = chip.getBoundingClientRect()
    if (r.width <= 0) continue
    if (!tops.some((top) => Math.abs(top - r.top) < r.height / 2)) tops.push(r.top)
  }
  return tops.length
}

/**
 * Fit one contentful Token's chips (C5): every chip drawn, filling
 * bottom-heavy beside the name, while they take at most `MORE_LINES` lines;
 * past that, the chips that fit two lines with +MORE in the corner after the
 * cost, the rest marked over (`data-chip-over`, not drawn) and +MORE laid on
 * its slot, the bottom line's right end.
 *
 * It starts from every chip drawn and settles in one pass, so the same width
 * gives the same result: nothing flickers, nothing feeds back.
 */
export function fitMore(token: HTMLElement): void {
  const parts = partsOf(token)
  if (!parts) return
  const { strip, more, slot } = parts
  const { chips, keep } = chipsOf(strip)
  for (const chip of chips) chip.removeAttribute(OVER_ATTRIBUTE)
  more.hidden = true
  slot.hidden = true
  if (linesOf(chips) <= MORE_LINES) return
  more.hidden = false
  // The button's own box: the slot keeps its room, and +MORE lies on it.
  const size = (more.firstElementChild ?? more).getBoundingClientRect()
  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || CHIP_GAP
  const widths = chips.map((chip) => chip.getBoundingClientRect().width)
  const front = chips.length - keep
  let shown = moreFit(widths, size.width, strip.clientWidth, { gap, keep })
  // The first `shown` chips, and the kept ones (the cost and its slots).
  const drawn = (index: number) => index < shown || index >= front
  const draw = () => {
    chips.forEach((chip, index) => {
      if (drawn(index)) chip.removeAttribute(OVER_ATTRIBUTE)
      else chip.setAttribute(OVER_ATTRIBUTE, '')
    })
  }
  slot.style.width = `${size.width}px`
  slot.style.height = `${size.height}px`
  slot.hidden = false
  draw()
  // The strip may settle a little narrower than it measured: drop another.
  while (shown > 0 && linesOf([...chips.filter((_, index) => drawn(index)), slot]) > MORE_LINES) {
    shown -= 1
    draw()
  }
  const at = slot.getBoundingClientRect()
  const from = token.getBoundingClientRect()
  more.style.setProperty('--su-more-x', `${at.left - from.left}px`)
  more.style.setProperty('--su-more-y', `${at.top - from.top}px`)
}

const watched = new Set<HTMLElement>()
let fontsWatched = false

/**
 * When a font loads every chip's width changes: fit every watched Token
 * again. A face loads when text first uses it, after `fonts.ready` may
 * already have settled, so each load is heard (`loadingdone`), not only the
 * first.
 */
function watchFonts(): void {
  if (fontsWatched || typeof document === 'undefined' || !document.fonts) return
  fontsWatched = true
  const refit = () => {
    for (const token of watched) fitMore(token)
  }
  void document.fonts.ready.then(refit)
  document.fonts.addEventListener?.('loadingdone', refit)
}

/**
 * Fit a Token now and whenever its head changes width (a resize, its
 * column); returns the stop. Only a width change refits: the head's height
 * is what the fit itself changes.
 */
export function watchMore(token: HTMLElement): () => void {
  if (!partsOf(token)) return () => undefined
  fitMore(token)
  watched.add(token)
  watchFonts()
  const head = token.firstElementChild
  if (!(head instanceof HTMLElement) || typeof ResizeObserver === 'undefined') {
    return () => watched.delete(token)
  }
  let width = head.getBoundingClientRect().width
  const observer = new ResizeObserver(() => {
    if (!token.isConnected) {
      observer.disconnect()
      watched.delete(token)
      return
    }
    const now = head.getBoundingClientRect().width
    if (Math.abs(now - width) < 0.5) return
    width = now
    fitMore(token)
  })
  observer.observe(head)
  return () => {
    observer.disconnect()
    watched.delete(token)
  }
}

/** A static page's contentful Tokens (server-rendered, no React): each fits once and on resize. */
export function watchStaticMore(root: ParentNode = document): void {
  for (const token of root.querySelectorAll<HTMLElement>(MORE_TOKEN)) watchMore(token)
}
