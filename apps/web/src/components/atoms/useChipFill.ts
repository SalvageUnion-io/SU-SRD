import type { RefObject } from 'react'
import { useEffect } from 'react'
import { watchChipFillTogether } from './chipFillWatch'

/**
 * Fit a head's chips from its bottom-right corner (`chipFill.ts`): the chips
 * that fit beside the name on its line, the rest rising, now and whenever the
 * head changes width or chips. Writes custom properties, not React state, so
 * a resize never re-renders. The heads one commit mounts are fitted together,
 * at the end of the effects' task (`watchChipFillTogether`).
 */
export function useChipFill(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const head = ref.current
    if (!enabled || !head) return
    return watchChipFillTogether(head)
  }, [ref, enabled])
}
