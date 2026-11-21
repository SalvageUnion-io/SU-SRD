/**
 * Sheet | Edit — the sheet's two states ("print reads, pencil writes"). The
 * band's control reads Sheet | Edit | Play; code and comments call the first
 * state Read.
 *
 * **Read** (the "Sheet" tab) is the printed sheet: identity typeset as label and value with the
 * empty fields left out, gauges and counters as read-outs, inventory as pills,
 * and no Manage, Assign or stepper anywhere. **Edit** is the same sheet with
 * every write affordance it already had. A sheet opens on the tab last used:
 * the toggle in its band switches, and the choice holds from one sheet to the
 * next and across a reload (this browser's `localStorage`, a convenience that
 * degrades to Read), so a player who is building does not re-press Edit on
 * every hop.
 *
 * The mode is the route's (`SheetView` provides it). A `<Sheet>` with no
 * provider (a component test, the public sheet's frozen render) has no
 * mode and keeps the behaviour it always had: writable when its caller lets it
 * write. A sheet the viewer cannot write (a crewmate's, the Starter Set's) has
 * no toggle — it is always Read.
 */

import { createContext, useContext } from 'react'
import { create } from 'zustand'
import { localStore } from '../../lib/safeLocalStorage'

export type SheetMode = {
  editing: boolean
  setEditing: (next: boolean) => void
}

export const SheetModeContext = createContext<SheetMode | null>(null)

/** The route's Read | Edit, or null outside a sheet route. */
export function useSheetMode(): SheetMode | null {
  return useContext(SheetModeContext)
}

/** Where this browser keeps the last tab: `'edit'`, or absent for Sheet. */
export const SHEET_MODE_KEY = 'su:sheet-mode'

/** The remembered tab; Read where storage is missing, blocked or empty. */
export function storedEditing(): boolean {
  try {
    return localStore()?.getItem(SHEET_MODE_KEY) === 'edit'
  } catch {
    return false
  }
}

function rememberEditing(editing: boolean) {
  try {
    if (editing) localStore()?.setItem(SHEET_MODE_KEY, 'edit')
    else localStore()?.removeItem(SHEET_MODE_KEY)
  } catch {
    // A full or blocked store only costs the remembered tab.
  }
}

/** The last tab used: held for the visit, and remembered across a reload. */
export const useSheetModeStore = create<SheetMode>((set) => ({
  editing: storedEditing(),
  setEditing: (next) => {
    rememberEditing(next)
    set({ editing: next })
  },
}))
