/**
 * privateRolls — what the Mediator's Rolls do differently, for the rolls
 * drawn under `PlayMediatorCockpit` (every other screen reads the defaults):
 *
 *  - `PrivateRolls`: the Private rolls switch is on (r6 B10). A roll reads
 *    "Roll privately" and the Rolls carry a Private band, so a busy Mediator
 *    sees at a glance that the next roll stays theirs. What a roll records is
 *    `playRolls.model`'s `setPrivateRolls`.
 *  - `FoldRolledTables`: an opened roll table folds to the row it landed on
 *    once rolled (r6 B6), so it never pushes the encounter's notes off screen.
 */

import { createContext, useContext } from 'react'

export const PrivateRolls = createContext(false)

/** Whether rolls made here are private now. */
export function usePrivateRolls(): boolean {
  return useContext(PrivateRolls)
}

export const FoldRolledTables = createContext(false)

/** Whether a rolled table folds to its result row. */
export function useFoldRolledTables(): boolean {
  return useContext(FoldRolledTables)
}
