import type { RefObject } from 'react'
import { useEffect } from 'react'

/** The width under which the chips may drop (`entity-forms.css`). */
const PHONE = '(max-width: 40rem)'

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
 * Whether a cut-out head's chips fit on one line beside its name, written to
 * the heading as `data-chips="beside"` or `"under"`. A phone's stylesheet
 * (`.su-entity-row__heading--cut`) drops the chips under the name onto the
 * paper only when they are `under`; until this has run (a static page with no
 * script) they drop, as before. Measured, not guessed from the viewport: a
 * short name and two chips fit on a phone, a long name and four do not.
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
      const fits = oneLineWidth(name) + gap + oneLineWidth(chips) <= heading.clientWidth + 0.5
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
