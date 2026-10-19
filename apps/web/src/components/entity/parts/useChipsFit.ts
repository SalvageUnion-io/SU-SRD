import type { RefObject } from 'react'
import { useEffect } from 'react'
import { widthAtLeast } from '../../../design/tokens'
import { chipLines } from './chipFit'

/** A phone (`entity-forms.css`): under it the name keeps one line and the chips drop sooner. */
const PHONE = `not ${widthAtLeast('sm')}`

/**
 * The most lines the chips may take beside the name: a compact head
 * double-rows its chips, never more (`chips-and-actions.md` C5). More than
 * this and the band would grow into a tall, thin column of chips over a short
 * name: they drop under it instead.
 */
export const MAX_CHIP_LINES = 2

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

/** The groups a chip sits in, read through to their chips: a strip, its labels, a class lane. */
const GROUPS = ['su-chips', 'su-entity-row__labels', 'su-chip-lane']

/**
 * The chips, in order: the chip group's own children, a nested `.su-chips`,
 * labels group or class lane (`Chips`) read through to its chips.
 */
function chipItems(chips: HTMLElement): Element[] {
  const items: Element[] = []
  const take = (parent: Element) => {
    for (const child of parent.children) {
      if (GROUPS.some((group) => child.classList.contains(group))) take(child)
      else items.push(child)
    }
  }
  take(chips)
  return items
}

/** Each chip's width, in order. */
function chipWidths(chips: HTMLElement): number[] {
  return chipItems(chips)
    .map((item) => item.getBoundingClientRect().width)
    .filter((width) => width > 0)
}

/** How many lines the chips take as laid out: their distinct tops. */
function laidOutLines(chips: HTMLElement): number {
  const tops: number[] = []
  for (const item of chipItems(chips)) {
    const r = item.getBoundingClientRect()
    if (r.width <= 0) continue
    if (!tops.some((top) => Math.abs(top - r.top) < r.height / 2)) tops.push(r.top)
  }
  return tops.length
}

/**
 * Whether a cut-out head's chips fit beside its name, written to the heading
 * as `data-chips="beside"` or `"under"` (`.su-entity-row__heading--cut`
 * drops them under the name onto the paper). They fit when, in the room the
 * name leaves on the band on its one line, they take at most
 * `MAX_CHIP_LINES` lines: a chip group that wraps stays in the head, its last
 * line on the name's capitals and the rest balanced above (owner's rule,
 * 2026-10-14), as a short one does.
 *
 * - **On a phone** that is measured every time. Until this has run (a static
 *   page with no script) they drop, as before.
 * - **Wider**, the name may wrap beside them, so a head is left as it is
 *   while its chips stay inside it on at most `MAX_CHIP_LINES` lines (the
 *   common case: one read, no write). Only one that breaks that (a long
 *   chip, a Game's name, past the Row's edge: R3) drops them under,
 *   and goes back beside only when they fit beside the one-line name, so
 *   the switch never flips back and forth.
 *
 * Measured, not guessed from the viewport or the chip count: the name's
 * length and each chip's width decide.
 *
 * Writes the attribute itself, not React state, so a resize never re-renders.
 */
export function useChipsFit(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const heading = ref.current
    if (!enabled || !heading || typeof ResizeObserver === 'undefined') return
    const phone = window.matchMedia?.(PHONE)
    const measure = () => {
      const name = heading.firstElementChild
      const chips = heading.lastElementChild
      if (!(name instanceof HTMLElement) || !(chips instanceof HTMLElement) || name === chips) {
        return
      }
      if (!phone?.matches && heading.dataset.chips !== 'under') {
        const inside = heading.scrollWidth <= heading.clientWidth + 0.5
        if (inside && laidOutLines(chips) <= MAX_CHIP_LINES) return
        heading.dataset.chips = 'under'
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
