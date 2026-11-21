import { createContext, useContext } from 'react'

/**
 * How a surface draws its section heads, one look a site (R1: `Slab` takes no
 * `variant`).
 *
 *   `auto` (the default everywhere) — a section head is the ink strip with its
 *          cut-out title, a Mini Slab inside a card the stamp, so the
 *          Reference, the front pages and the app read as one site.
 *   `stamp` — Play, approved as it is, pins the solid ink section stamp and
 *          its leader rule on every head (`PlayFrame`).
 */
export type SlabLook = 'stamp' | 'auto'

const SlabLookContext = createContext<SlabLook>('auto')

export const SlabLookProvider = SlabLookContext.Provider

export function useSlabLook(): SlabLook {
  return useContext(SlabLookContext)
}
