/**
 * undoToast — an edit that takes something off a sheet (a removed System, a
 * swapped chassis) lands at once, as every Free Edit write does, and says so
 * in a toast whose Undo puts it back: a mis-press costs one press, as Play's
 * spends do.
 */

import { toast } from '../../components/index'
import { componentsCopy } from '../../messages/components'

export function undoToast(message: string, undo: () => void) {
  toast(message, { action: { label: componentsCopy('undo'), onClick: undo } })
}
