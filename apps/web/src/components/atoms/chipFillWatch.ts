/**
 * Watching the heads that fill from their bottom-right corner (`chipFill.ts`)
 * and contentful Minis (`chipFit.ts`): each fits now and again whenever a box
 * of it resizes, a face loads or its chips change. One ResizeObserver serves
 * every head, so a frame's resizes fit together, and a kind that fits many
 * at once reads them all before it writes.
 */

import { FILL_HEAD, FILL_NAME, fitChipFill, ITEM_ATTRIBUTE } from './chipFill'

/** Fit one head. */
type FitOne = (head: HTMLElement) => void
/** Fit many heads at once: reads batched before writes, so they lay out once. */
type FitMany = (heads: readonly HTMLElement[]) => void

/** A watched head: how it fits, and its own observers' upkeep. */
type Watch = { fit: FitOne; many: FitMany | undefined; track: () => void; stop: () => void }

/** Every watched head. */
const live = new Map<HTMLElement, Watch>()
let fontsWatched = false

/**
 * Fit `heads` now: each kind that fits many at once (`FitMany`) in one batch,
 * the rest one by one; then each watches what its fit drew.
 */
function fitAll(heads: readonly HTMLElement[]): void {
  const batches = new Map<FitMany, HTMLElement[]>()
  for (const head of heads) {
    const watch = live.get(head)
    if (!watch) continue
    if (!head.isConnected) {
      watch.stop()
      continue
    }
    if (!watch.many) {
      watch.fit(head)
      continue
    }
    const batch = batches.get(watch.many) ?? []
    batch.push(head)
    batches.set(watch.many, batch)
  }
  for (const [many, batch] of batches) many(batch)
  for (const head of heads) live.get(head)?.track()
}

/**
 * The one ResizeObserver every head shares, so a frame's resizes are fitted
 * together (`fitAll`): one observer per head called its fit once per head,
 * each fit laying out the page again.
 */
let resize: ResizeObserver | undefined
/** The heads each observed box belongs to. */
const headsOf = new Map<Element, Set<HTMLElement>>()
/** Each observed box's size at its last report. */
const sizes = new WeakMap<Element, string>()

/** The constructor that made `resize`: a page's never changes; a test swaps it for a fake. */
let madeBy: typeof ResizeObserver | undefined

function sharedResize(): ResizeObserver | undefined {
  if (typeof ResizeObserver === 'undefined') return undefined
  if (resize && madeBy === ResizeObserver) return resize
  resize?.disconnect()
  madeBy = ResizeObserver
  resize = new ResizeObserver((entries) => {
    const heads = new Set<HTMLElement>()
    for (const entry of entries) {
      // A head taken off the page stops its own watch.
      for (const head of [...(headsOf.get(entry.target) ?? [])])
        if (!head.isConnected) live.get(head)?.stop()
      // A box's first report is the size the fit that observed it left: no
      // change. Fitting on it fitted every head of a page again in one task.
      const size = `${entry.contentRect?.width},${entry.contentRect?.height}`
      const last = sizes.get(entry.target)
      sizes.set(entry.target, size)
      if (last === undefined || last === size) continue
      for (const head of headsOf.get(entry.target) ?? []) heads.add(head)
    }
    fitAll([...heads])
  })
  for (const el of headsOf.keys()) resize.observe(el)
  return resize
}

function observe(el: Element, head: HTMLElement): void {
  const heads = headsOf.get(el) ?? new Set<HTMLElement>()
  if (heads.size === 0) sharedResize()?.observe(el)
  heads.add(head)
  headsOf.set(el, heads)
}

function unobserve(el: Element, head: HTMLElement): void {
  const heads = headsOf.get(el)
  if (!heads) return
  heads.delete(head)
  if (heads.size > 0) return
  headsOf.delete(el)
  sizes.delete(el)
  resize?.unobserve(el)
  // Nothing left to watch: let the observer go (a new one starts with the next head).
  if (headsOf.size > 0) return
  resize?.disconnect()
  resize = undefined
}

/** A face loads when text first uses it: every chip's width changes, so fit again. */
function watchFonts(): void {
  if (fontsWatched || typeof document === 'undefined' || !document.fonts) return
  fontsWatched = true
  const refit = () => fitInTurns([...live.keys()])
  void document.fonts.ready.then(refit)
  document.fonts.addEventListener?.('loadingdone', refit)
}

/**
 * Fit a head (with `fit`, a fill head's by default; a contentful Mini's is
 * `chipFit.ts`'s, which also fits `many` at once) now and whenever its width,
 * its name's or a chip's changes (a resize, a face loading, a live reading)
 * or its chips change; returns the stop. A fit that reads what the last one
 * read writes nothing, so the resizes its own writes cause end there.
 */
export function watchChipFill(
  container: HTMLElement,
  fitOne: FitOne = fitChipFill,
  many?: FitMany
): () => void {
  const stop = watchQuietly(container, fitOne, many)
  fitAll([container])
  return stop
}

/** Watch a head (`watchChipFill`) without fitting it now: its first fit is the caller's. */
function watchQuietly(
  container: HTMLElement,
  fitOne: FitOne,
  many: FitMany | undefined
): () => void {
  if (live.has(container)) return () => undefined
  // What is observed: observing a box again reports it again, and that report
  // fits again, so only a box new to the flow is observed (and one gone from
  // it let go). Re-observing all of them on every fit kept a page with many
  // heads fitting every frame, never idle.
  const observed = new Set<Element>()
  const track = () => {
    // What the fit itself wrote (its first row) is no change of chips.
    mutation?.takeRecords()
    if (!sharedResize()) return
    const name = container.querySelector(`:scope > ${FILL_NAME}`)
    const now = new Set<Element>([container, ...container.querySelectorAll(`[${ITEM_ATTRIBUTE}]`)])
    if (name) now.add(name)
    for (const el of observed) {
      if (now.has(el)) continue
      unobserve(el, container)
      observed.delete(el)
    }
    for (const el of now) {
      if (observed.has(el)) continue
      observe(el, container)
      observed.add(el)
    }
  }
  // The set of chips changes (a menu's slot, a chip added).
  const mutation =
    typeof MutationObserver === 'undefined'
      ? undefined
      : new MutationObserver(() => fitAll([container]))
  const stop = () => {
    live.delete(container)
    for (const el of observed) unobserve(el, container)
    observed.clear()
    mutation?.disconnect()
  }
  live.set(container, { fit: fitOne, many, track, stop })
  watchFonts()
  mutation?.observe(container, { childList: true, subtree: true, characterData: true })
  return stop
}

/** How long one task may fit for: a task over 50ms blocks the page (TBT). */
const TURN_MS = 30
/** How many heads fit between looks at the clock. */
const STEP = 4

/**
 * Set on the root while heads wait for a later turn, so a capture (the layout
 * gates' settle) can wait for every head to be fitted.
 */
const FITTING_ATTRIBUTE = 'data-chip-fitting'
/** The fits still queued, across every `fitInTurns`. */
let queued = 0

function markQueued(delta: number): void {
  queued += delta
  if (typeof document === 'undefined') return
  document.documentElement.toggleAttribute(FITTING_ATTRIBUTE, queued > 0)
}

/**
 * Fit many watched heads a turn at a time: those on screen first, now (a
 * shift in view counts against the page, one off screen does not), the rest
 * in tasks of at most `TURN_MS`, so the main thread is never held long (TBT).
 */
function fitInTurns(containers: HTMLElement[]): void {
  if (containers.length <= STEP || typeof setTimeout === 'undefined') {
    fitAll(containers)
    return
  }
  const height = typeof innerHeight === 'number' ? innerHeight : 0
  const now: HTMLElement[] = []
  const later: HTMLElement[] = []
  for (const head of containers) {
    const r = head.getBoundingClientRect()
    if (r.bottom > 0 && r.top < height) now.push(head)
    else later.push(head)
  }
  fitAll(now)
  if (later.length === 0) return
  markQueued(1)
  const next = () => {
    const start = performance.now()
    do fitAll(later.splice(0, STEP))
    while (later.length > 0 && performance.now() - start < TURN_MS)
    if (later.length > 0) setTimeout(next, 0)
    else markQueued(-1)
  }
  setTimeout(next, 0)
}

/**
 * A static page's heads (server-rendered, no React) that `selector` finds:
 * each watched, fitted with `fit` (or `many` at once) in turns, and on resize.
 */
export function watchStaticChipFill(
  root: ParentNode = document,
  selector = FILL_HEAD,
  fit: FitOne = fitChipFill,
  many?: FitMany
): void {
  const heads = [...root.querySelectorAll<HTMLElement>(selector)]
  // Watched without a fit of its own, then fitted in turns together.
  for (const head of heads) watchQuietly(head, fit, many)
  fitInTurns(heads)
}
