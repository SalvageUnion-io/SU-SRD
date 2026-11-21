/**
 * undoToast — an edit that takes something off a sheet (a removed System, a
 * swapped chassis) lands at once, as every Free Edit write does, and says so
 * in a toast whose Undo puts it back: a mis-press costs one press, as Play's
 * spends do.
 *
 * It waits for the player: the line stands until it is answered, dismissed, or
 * the sheet changes again (after which its Undo would write over the newer
 * change). One sheet holds one such line; the Change Log's Restore is the way
 * back after that.
 */

import { toast } from '../../components/index'
import { componentsCopy } from '../../messages/components'
import { onUnitWrite } from '../../replica/units'

/** Sheets with a standing Undo line, by unit id. */
const standing = new Set<string>()

const toastId = (sheetId: string) => `undo:${sheetId}`

let watching = false

/** The sheet changed (or is gone): its standing Undo leaves. */
export function sheetChanged(sheetId: string): void {
  if (!standing.delete(sheetId)) return
  toast.dismiss(toastId(sheetId))
}

/**
 * Say what was taken off, with Undo. Call it AFTER the write it reports: the
 * line leaves on the sheet's next write. `sheetId` is the unit's id.
 */
export function undoToast(message: string, undo: () => void, sheetId: string) {
  if (!watching) {
    watching = true
    onUnitWrite(sheetChanged)
  }
  standing.add(sheetId)
  toast(message, {
    id: toastId(sheetId),
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    action: {
      label: componentsCopy('undo'),
      onClick: () => {
        standing.delete(sheetId)
        undo()
      },
    },
    onDismiss: () => standing.delete(sheetId),
  })
}
