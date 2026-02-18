import { createContext, useContext } from 'react'

export const StickyHeaderContext = createContext(false)

export function useStickyHeader() {
  return useContext(StickyHeaderContext)
}
