import { createContext, useContext } from 'react'

/**
 * How a surface draws its section heads.
 *
 *   `stamp` (default) — the solid ink section stamp and its leader rule (R1).
 *   `rule`  — a label on a rule: the section's name in condensed caps over a
 *             2px ink rule, its tally in plain tabular numerals at the rule's
 *             end. A Live Sheet, a Game page and the Starter crew read this
 *             way in the mock; the Reference and Play keep the stamp.
 *
 * A surface sets it once (`SlabLookProvider`), so every `Slab` and
 * `SlabSection` under it changes together and no call site picks a variant.
 */
/**
 * `auto`, the default everywhere, is the ink strip with
 * its cut-out title (`rule`) for a section head and the stamp for a Mini Slab
 * inside a card, so the Reference, the front pages and the app read as one
 * site. Play, approved as it is, pins `stamp`.
 */
export type SlabLook = 'stamp' | 'rule' | 'auto'

const SlabLookContext = createContext<SlabLook>('auto')

export const SlabLookProvider = SlabLookContext.Provider

export function useSlabLook(): SlabLook {
  return useContext(SlabLookContext)
}
