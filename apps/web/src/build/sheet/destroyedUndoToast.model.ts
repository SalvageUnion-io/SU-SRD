/**
 * destroyedUndoToast — cycling an item's status badge onto
 * 'destroyed' mid-combat is jarring when it's a mis-tap, so the write goes
 * through immediately (the player stays in control per ADR-007) but a toast
 * offers a one-click Undo that restores the previous condition.
 *
 * The document's one toaster is mounted app-wide (`ToasterMount` in routes/__root.tsx).
 */

import { toast } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { componentsCopy } from '../../messages/components'

export function destroyedUndoToast(itemName: string, undo: () => void) {
  toast(buildSheetCopy('markedDestroyed', { name: itemName }), {
    action: {
      label: componentsCopy('undo'),
      onClick: undo,
    },
  })
}
