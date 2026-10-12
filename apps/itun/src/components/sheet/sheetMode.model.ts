/**
 * Read | Edit — the sheet's two states (brand refresh P4, issue 1255, board 10:
 * "print reads, pencil writes").
 *
 * **Read** is the printed sheet: identity typeset as label and value with the
 * empty fields left out, gauges and counters as read-outs, inventory as pills,
 * and no Manage, Assign or stepper anywhere. **Edit** is the same sheet with
 * every write affordance it already had. A sheet opens in Read; the toggle in
 * its band switches, and the choice holds for the rest of the visit, from one
 * sheet to the next, so a player who is building does not re-press Edit on
 * every hop.
 *
 * The mode is the route's (`SheetView` provides it). A `<Sheet>` with no
 * provider (a component test, a story, the public sheet's frozen render) has no
 * mode and keeps the behaviour it always had: writable when its caller lets it
 * write. A sheet the viewer cannot write (a crewmate's, the Starter Set's) has
 * no toggle — it is always Read.
 */

import { createContext, useContext } from 'react'
import { create } from 'zustand'

export type SheetMode = {
  editing: boolean
  setEditing: (next: boolean) => void
}

export const SheetModeContext = createContext<SheetMode | null>(null)

/** The route's Read | Edit, or null outside a sheet route. */
export function useSheetMode(): SheetMode | null {
  return useContext(SheetModeContext)
}

/** Held for the visit (memory only): a sheet opens in Read until Edit is pressed. */
export const useSheetModeStore = create<SheetMode>((set) => ({
  editing: false,
  setEditing: (next) => set({ editing: next }),
}))
