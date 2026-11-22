/**
 * Every wizard step opens at the top with focus on its heading (WCAG 2.4.3),
 * the first included: the page that led here (the chooser, a step's Next) may
 * have been left scrolled. A step whose one ask is a field opens on it
 * instead (`focusId`: the NPC's name on a template's one page, r6 B3).
 */

import { useEffect, useRef } from 'react'

export function useStepFocus(active: number, focusId: string | undefined) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const shownStep = useRef<number | null>(null)
  useEffect(() => {
    if (shownStep.current === active) return
    shownStep.current = active
    window.scrollTo(0, 0)
    const field = focusId === undefined ? null : document.getElementById(focusId)
    ;(field ?? headingRef.current)?.focus({ preventScroll: true })
  }, [active, focusId])
  return headingRef
}
