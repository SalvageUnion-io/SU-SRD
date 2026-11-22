/**
 * useShownSheet — the sheet is a shared page's (`PublicSheet`): a reader came to
 * see the build, not to play it (r5 C18). Read where a phone's order is
 * chosen: a shared Mech leads with its Systems and Modules.
 */

import { createContext, useContext } from 'react'

export const ShownSheetContext = createContext(false)

/** Whether this sheet is a shared page's. */
export function useShownSheet(): boolean {
  return useContext(ShownSheetContext)
}
