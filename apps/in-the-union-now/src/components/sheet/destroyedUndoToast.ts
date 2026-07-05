/**
 * destroyedUndoToast — U-6 polish: cycling an item's status badge onto
 * 'destroyed' mid-combat is jarring when it's a mis-tap, so the write goes
 * through immediately (the player stays in control per ADR-007) but a toast
 * offers a one-click Undo that restores the previous condition.
 *
 * statUndoToast generalises the same pattern to routine stat mutations
 * (a damage/HP/SP apply): the write lands immediately, and a transient toast
 * offers a one-click revert to the prior value. It stays a toast, not a
 * change-log — ADR-007 keeps the player in control, this only softens fat
 * fingers.
 *
 * The Toaster is already mounted app-wide in routes/__root.tsx.
 */

import { toast } from 'suref-react'

export function destroyedUndoToast(itemName: string, undo: () => void) {
  toast(`${itemName} marked Destroyed`, {
    action: {
      label: 'Undo',
      onClick: undo,
    },
  })
}

/** One-click Undo toast for a routine stat write (revert to the prior value). */
export function statUndoToast(message: string, undo: () => void) {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: undo,
    },
  })
}
