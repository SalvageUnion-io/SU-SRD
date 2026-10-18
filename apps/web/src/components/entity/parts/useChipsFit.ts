import type { RefObject } from 'react'
import { useEffect } from 'react'
import { widthAtLeast } from '../../../design/tokens'

/** The width under which the chips may drop (`entity-forms.css`). */
const PHONE = `not ${widthAtLeast('sm')}`

/**
 * The most lines the chips may take beside the name: a compact head
 * double-rows its chips, never more (`chips-and-actions.md` C5). More than
 * this and the band would grow into a tall, thin column of chips over a short
 * name: they drop under it instead.
 */
export const MAX_CHIP_LINES = 2

/** The chips' 2px side margins: the 4px gap between two on a line (`.su-chips`). */
const CHIP_GAP = 4

/** The width an element takes on one line, unwrapped (its max-content). */
function oneLineWidth(el: HTMLElement): number {
  const { width, flex } = el.style
  el.style.width = 'max-content'
  // Neither grown to the line (a dropped strip is the line's width) nor shrunk.
  el.style.flex = 'none'
  const measured = el.getBoundingClientRect().width
  el.style.width = width
  el.style.flex = flex
  return measured
}

/**
 * Each chip's width, in order: the chip group's own children, a nested
 * `.su-chips` or labels group read through to its chips.
 */
function chipWidths(chips: HTMLElement): number[] {
  const items: Element[] = []
  for (const child of chips.children) {
    if (child.classList.contains('su-chips') || child.classList.contains('su-entity-row__labels'))
      items.push(...child.children)
    else items.push(child)
  }
  return items.map((item) => item.getBoundingClientRect().width).filter((width) => width > 0)
}

/**
 * How many lines `widths` take packed into `room`, each chip whole, or
 * `Infinity` when one chip is wider than the room. Balancing evens the lines
 * out; it never adds one.
 */
export function chipLines(widths: readonly number[], room: number): number {
  let lines = 0
  let used = 0
  for (const width of widths) {
    if (width > room + 0.5) return Number.POSITIVE_INFINITY
    if (lines === 0 || used + CHIP_GAP + width > room + 0.5) {
      lines += 1
      used = width
    } else used += CHIP_GAP + width
  }
  return lines
}

/**
 * Whether a cut-out head's chips fit beside its name, written to the heading
 * as `data-chips="beside"` or `"under"`. They fit when, in the room the name
 * leaves on the band, they take at most `MAX_CHIP_LINES` lines: a chip group
 * that wraps stays in the head, its last line on the name's capitals and the
 * rest balanced above (owner's rule, 2026-10-14), as a short one does. Only
 * when the room is too narrow for that does a phone's stylesheet
 * (`.su-entity-row__heading--cut`) drop them under the name onto the paper.
 * Until this has run (a static page with no script) they drop, as before.
 * Measured, not guessed from the viewport or the chip count: the name's
 * length and each chip's width decide.
 *
 * Writes the attribute itself, not React state, so a resize never re-renders.
 */
export function useChipsFit(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const heading = ref.current
    if (!enabled || !heading || typeof ResizeObserver === 'undefined') return
    // Only a phone's stylesheet reads the mark (wider, the chips are always
    // beside the name), so only a phone pays for the measuring.
    const phone = window.matchMedia?.(PHONE)
    const measure = () => {
      if (!phone?.matches) return
      const name = heading.firstElementChild
      const chips = heading.lastElementChild
      if (!(name instanceof HTMLElement) || !(chips instanceof HTMLElement) || name === chips) {
        return
      }
      const gap = Number.parseFloat(getComputedStyle(heading).columnGap) || 0
      const room = heading.clientWidth - oneLineWidth(name) - gap
      const widths = chipWidths(chips)
      const fits =
        widths.length > 0
          ? chipLines(widths, room) <= MAX_CHIP_LINES
          : oneLineWidth(chips) <= room + 0.5
      heading.dataset.chips = fits ? 'beside' : 'under'
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(heading)
    phone?.addEventListener('change', measure)
    return () => {
      observer.disconnect()
      phone?.removeEventListener('change', measure)
    }
  }, [ref, enabled])
}
