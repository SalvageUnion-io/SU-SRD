import { createContext, useContext } from 'react'

export const StickyHeaderContext = createContext(false)

export function useStickyHeader() {
  return useContext(StickyHeaderContext)
}

/** Pixel offset for nested sticky headers. 0 = no parent offset (use --app-nav-h). */
export const StickyOffsetContext = createContext(0)
