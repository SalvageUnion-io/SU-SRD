import type { RefObject } from 'react'
import { useEffect } from 'react'
import { widthAtLeast } from '../../../design/tokens'
import { chipLines } from './chipFit'

/** A phone (`entity-forms.css`): under it the name keeps one line and the chips rise sooner. */
const PHONE = `not ${widthAtLeast('sm')}`

/** The width an element takes on one line, unwrapped (its max-content). */
function oneLineWidth(el: HTMLElement): number {
  const { width, flex } = el.style
  el.style.width = 'max-content'
  // Neither grown to the line (a raised strip is the line's width) nor shrunk.
  el.style.flex = 'none'
  const measured = el.getBoundingClientRect().width
  el.style.width = width
  el.style.flex = flex
  return measured
}

/** The groups a chip sits in, read through to their chips: a strip, its labels, a class lane. */
const GROUPS = ['su-chips', 'su-entity-row__labels', 'su-chip-lane']

/** Base UI's own nodes a popup's trigger gains while it is open. */
const NOT_CHIPS = ['data-base-ui-focus-guard', 'data-base-ui-portal']

/**
 * The chips, in order: the chip group's own children, a nested `.su-chips`,
 * labels group or class lane (`Chips`) read through to its chips.
 */
function chipItems(chips: HTMLElement): Element[] {
  const items: Element[] = []
  const take = (parent: Element) => {
    for (const child of parent.children) {
      if (GROUPS.some((group) => child.classList.contains(group))) take(child)
      // An open menu's focus guards and portal sit beside its "⋯": no chips.
      else if (NOT_CHIPS.some((attr) => child.hasAttribute(attr))) continue
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

/**
 * Whether a cut-out head's chips fit beside its name, written to the heading
 * as `data-chips="beside"` or `"over"` (`.su-entity-row__heading--cut`
 * raises them onto the band's full width above the name). They stay beside it on as many
 * lines as they need, the last on the name's capitals and the rest stacked
 * above it, up the band (owner's rules, 2026-10-14 and 2026-10-20): they rise
 * over it only when one chip is wider than the room the name leaves.
 *
 * - **On a phone** that is measured every time, against the name's one line.
 *   Until this has run (a static page with no script) they rise over it.
 * - **Wider**, the name may wrap beside them, so a head is left as it is
 *   while its chips stay inside it (the common case: one read, no write).
 *   Only one that breaks that (a long chip, a Game's name, past the Row's
 *   edge: R3) raises them over it, and goes back beside only when they fit
 *   beside the one-line name, so the switch never flips back and forth.
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
    // What the last answer was measured at: the heading's width and its chips'.
    // Raising the chips over the name (or bringing them back) changes the head's
    // height alone, which fires the observer again; measured at the same
    // widths, the answer stands, so a head never flips back and forth.
    let measuredAt = ''
    const measure = () => {
      const name = heading.firstElementChild
      const chips = heading.lastElementChild
      if (!(name instanceof HTMLElement) || !(chips instanceof HTMLElement) || name === chips) {
        return
      }
      const at = `${heading.clientWidth}:${phone?.matches}:${chipWidths(chips).join(',')}`
      if (at === measuredAt) return
      measuredAt = at
      if (!phone?.matches && heading.dataset.chips !== 'over') {
        if (heading.scrollWidth <= heading.clientWidth + 0.5) return
        heading.dataset.chips = 'over'
        return
      }
      const gap = Number.parseFloat(getComputedStyle(heading).columnGap) || 0
      const room = heading.clientWidth - oneLineWidth(name) - gap
      // The strip fills from its bottom-right corner: it packs from its end.
      const widths = chipWidths(chips).reverse()
      // On as many lines as they take: only a chip wider than the room raises them over it.
      const fits =
        widths.length > 0
          ? Number.isFinite(chipLines(widths, room))
          : oneLineWidth(chips) <= room + 0.5
      heading.dataset.chips = fits ? 'beside' : 'over'
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
