/**
 * privateRolls — whether the Mediator's Private rolls switch is on, for the
 * rolls drawn under it (r6 B10): a roll reads "Roll privately" and the Rolls
 * carry a Private band, so a busy Mediator sees at a glance that the next roll
 * stays theirs. `PlayMediatorCockpit` provides it; every other screen reads
 * false. What a roll records is `playRolls.model`'s `setPrivateRolls`.
 */

import { createContext, useContext } from 'react'

export const PrivateRolls = createContext(false)

/** Whether rolls made here are private now. */
export function usePrivateRolls(): boolean {
  return useContext(PrivateRolls)
}
