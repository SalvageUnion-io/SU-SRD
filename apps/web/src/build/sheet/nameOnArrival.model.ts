/**
 * A Mech that was just made opens with its name selected for typing (r7 G4,
 * G5): Build With This and Make a copy hand the new Mech's id here as they
 * open its sheet, in Edit; its name field reads it, opens and selects the
 * name, then lets it go. One Mech at a time: the next build replaces it.
 */

import { useSheetModeStore } from './sheetMode.model'

let pending: string | null = null

/** Open the sheet of `id` in Edit with its name selected for typing. */
export function typeNameOnArrival(id: string): void {
  pending = id
  useSheetModeStore.getState().setEditing(true)
}

/** Whether the sheet of `id` should open with its name selected. */
export function nameAwaitsTyping(id: string): boolean {
  return pending === id
}

/** The name field took it: a later visit opens as usual. */
export function nameTyped(id: string): void {
  if (pending === id) pending = null
}
