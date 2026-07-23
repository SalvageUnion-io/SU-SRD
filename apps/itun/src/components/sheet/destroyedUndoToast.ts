/**
 * destroyedUndoToast — U-6 polish: cycling an item's status badge onto
 * 'destroyed' mid-combat is jarring when it's a mis-tap, so the write goes
 * through immediately (the player stays in control per ADR-007) but a toast
 * offers a one-click Undo that restores the previous condition.
 *
 * The Toaster is already mounted app-wide in routes/__root.tsx.
 */

import { toast } from 'component-lib'

export function destroyedUndoToast(itemName: string, undo: () => void) {
  toast(`${itemName} marked Destroyed`, {
    action: {
      label: 'Undo',
      onClick: undo,
    },
  })
}
