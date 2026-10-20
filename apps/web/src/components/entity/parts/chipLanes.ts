import { CHIP_CLASSES } from './chipSet'

/**
 * THE LANES OF A LIST (`chips-and-actions.md` C6, hard rule R2): in a list,
 * every chip class is a column every line shares. A LIST is the lines that
 * share a parent, each a Compact (with the wrappers it sits in alone:
 * its `li`, a grid cell); `e2e/_chipLanes.ts` reads lists the same way.
 *
 * Each line's strip (`Chips` with `lanes`) joins its list here. A list whose
 * lines are one width (a column, a grid's cells; `measure`)
 * measures every class's widest lane across its lines and writes it on the
 * list element as `--su-lane-<class>` (`0px` where no line has the class),
 * so wherever a line is wide enough for its lanes (the container query in
 * `entity-forms.css`), each lane reserves that width: a class starts on one
 * edge down the list, and an absent value leaves its cell empty. Narrower,
 * the lanes draw no box and each line packs right.
 *
 * Measured, not guessed: a lane's own width with the list's widths lifted,
 * again whenever a strip in the list changes size (a reading, the fonts, a
 * resize across the breakpoint).
 */

/** What a line is: a Compact. A Mini holds no lanes (C6): its chips pack right. */
const LINE = '.su-entity-compact'

/**
 * A Card's frame. A Card is no line, so a strip whose nearest frame is a
 * Card's (its head) is in no list, even where the Card sits in a Compact-drawn
 * frame (a wizard step's `Box`): joining that frame's list gave every card in
 * the step one set of lane widths, which wrapped their heads, which
 * re-measured the lanes, and the cards never stopped moving.
 */
const CARD = '.su-ec-outer, .su-ec-frame'

type ListLanes = { strips: Set<HTMLElement>; observer: ResizeObserver | undefined; due: boolean }

const lists = new WeakMap<HTMLElement, ListLanes>()

/** The list a strip's line sits in, or null when the strip is no line's (a Card's head). */
function listOf(strip: HTMLElement): HTMLElement | null {
  let line = strip.closest(`${LINE}, ${CARD}`)
  if (!line || line.matches(CARD)) return null
  while (line.parentElement && line.parentElement.childElementCount === 1) {
    line = line.parentElement
  }
  return line.parentElement
}

/**
 * Whether a list's lines stand in columns: two or more, every line one width
 * (a column, or a grid's equal cells), never sized to its own name.
 */
function isColumn(strips: Iterable<HTMLElement>): boolean {
  const widths = new Set<number>()
  let lines = 0
  for (const strip of strips) {
    const line = strip.isConnected ? strip.closest(LINE) : null
    if (!line) continue
    lines += 1
    widths.add(Math.round(line.getBoundingClientRect().width))
  }
  // A line alone is no list: it keeps its own wrapping strip.
  return lines > 1 && widths.size === 1
}

/**
 * Each class's widest lane across a list's strips, its widths lifted first.
 * Only a list whose lines are one width keeps its lanes
 * (`data-chip-lanes="column"`): lines sized to their names (a fit list that
 * wraps) share no column, and pack. Every due list is lifted, then every one
 * read, then every one written, so a page of lists takes one layout.
 */
function measure(due: [HTMLElement, ListLanes][]): void {
  for (const [list, lanes] of due) {
    lanes.due = false
    for (const cls of CHIP_CLASSES) list.style.removeProperty(`--su-lane-${cls}`)
    list.setAttribute('data-chip-lanes', 'column')
  }
  const read = due.map(([list, lanes]) => {
    if (!isColumn(lanes.strips)) return { list, widest: undefined }
    const widest = new Map<string, number>(CHIP_CLASSES.map((cls) => [cls, 0]))
    for (const strip of lanes.strips) {
      if (!strip.isConnected) continue
      for (const lane of strip.children) {
        const cls = lane.getAttribute('data-chip-class')
        if (!cls) continue
        // A packed line's lanes draw no box: they measure 0 and change nothing.
        const width = lane.getBoundingClientRect().width
        widest.set(cls, Math.max(widest.get(cls) ?? 0, width))
      }
    }
    return { list, widest }
  })
  for (const { list, widest } of read) {
    if (!widest) {
      list.setAttribute('data-chip-lanes', 'loose')
      continue
    }
    for (const [cls, width] of widest) {
      list.style.setProperty(`--su-lane-${cls}`, `${Math.ceil(width)}px`)
    }
  }
}

/** The lists due a measure, measured together once this commit's strips have joined. */
const dueLists = new Map<HTMLElement, ListLanes>()

/** Measure the list once its strips of this commit have joined, before paint. */
function schedule(list: HTMLElement, lanes: ListLanes): void {
  if (lanes.due) return
  lanes.due = true
  if (dueLists.size === 0) {
    queueMicrotask(() => {
      const due = [...dueLists].filter(([, l]) => l.due)
      dueLists.clear()
      measure(due)
    })
  }
  dueLists.set(list, lanes)
}

/** A strip in no list has nothing to leave. */
const leaveNothing = () => undefined

/**
 * A strip joins the list its line sits in; returns its leave. A strip in no
 * list, or alone in one, still joins: a second line may arrive.
 */
export function joinLanes(strip: HTMLElement): () => void {
  const list = listOf(strip)
  if (!list) return leaveNothing
  let lanes = lists.get(list)
  if (!lanes) {
    const created: ListLanes = { strips: new Set(), observer: undefined, due: false }
    created.observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => schedule(list, created))
    lanes = created
    lists.set(list, lanes)
    list.setAttribute('data-chip-lanes', 'column')
  }
  const own = lanes
  own.strips.add(strip)
  own.observer?.observe(strip)
  schedule(list, own)
  return () => {
    own.strips.delete(strip)
    own.observer?.unobserve(strip)
    if (own.strips.size > 0) {
      schedule(list, own)
      return
    }
    own.observer?.disconnect()
    lists.delete(list)
    list.removeAttribute('data-chip-lanes')
    for (const cls of CHIP_CLASSES) list.style.removeProperty(`--su-lane-${cls}`)
  }
}

/**
 * A static page's line strips (server-rendered, no React to join them): each
 * joins its list once, from the one client entry (`islands.client.ts`).
 */
export function joinStaticLanes(root: ParentNode = document): void {
  for (const strip of root.querySelectorAll<HTMLElement>('.su-chips[data-lanes]')) {
    joinLanes(strip)
  }
}
