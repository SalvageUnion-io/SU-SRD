/**
 * undoToast — an edit that takes something off a sheet (a removed System, a
 * swapped chassis) lands at once, as every Free Edit write does, and says so
 * in a toast whose Undo puts it back: a mis-press costs one press, as Play's
 * spends do.
 *
 * The line stays as any toast with an action does (chrome K5: 20 seconds,
 * held under the pointer or the focus; r5 C3, over r2 C1's standing line),
 * and leaves sooner when it is answered, dismissed, the sheet changes again
 * (after which its Undo would write over the newer change), or the player
 * leaves the sheet (`leaveSheet`, r3 B3). One sheet holds one such line;
 * Ctrl+Z and the Change Log are the way back after that.
 *
 * A quick removal is the exception (r4 E3): its Undo puts back only what it
 * took off, on the sheet as it is now (`takeBack`), so it is safe after later
 * edits and each removal keeps its own line (`stack`), the newest three (K5).
 */

import { MOST_ACTION_TOASTS, toast } from '../../components/index'
import { dismissChangeUndo } from '../../lib/changeUndoToast'
import { componentsCopy } from '../../messages/components'
import { onUnitWrite } from '../../replica/units'
import { dismissRuleBreaks } from './ruleBreakToast.model'

/** Sheets with a standing Undo line, by unit id. */
const standing = new Set<string>()

const toastId = (sheetId: string) => `undo:${sheetId}`

/** Each sheet's stacked removal lines, oldest first. */
const stacked = new Map<string, string[]>()

/** How many removal lines one sheet holds; an older one leaves (Ctrl+Z still reaches it). */
const STACK = MOST_ACTION_TOASTS

let serial = 0

function unstack(sheetId: string, lineId: string): void {
  const lines = stacked.get(sheetId)?.filter((each) => each !== lineId) ?? []
  if (lines.length === 0) stacked.delete(sheetId)
  else stacked.set(sheetId, lines)
}

let watching = false

/** The sheet changed (or is gone): its standing Undo leaves. */
function sheetChanged(sheetId: string): void {
  if (!standing.delete(sheetId)) return
  toast.dismiss(toastId(sheetId))
}

/**
 * Say what was taken off, with Undo. Call it AFTER the write it reports: the
 * line leaves on the sheet's next write. `sheetId` is the unit's id.
 */
export function undoToast(
  message: string,
  undo: () => void,
  sheetId: string,
  { stack = false }: { stack?: boolean } = {}
) {
  if (stack) {
    serial += 1
    const lineId = `${toastId(sheetId)}:${serial}`
    const lines = [...(stacked.get(sheetId) ?? []), lineId]
    for (const old of lines.splice(0, Math.max(0, lines.length - STACK))) toast.dismiss(old)
    stacked.set(sheetId, lines)
    toast(message, {
      id: lineId,
      action: {
        label: componentsCopy('undo'),
        onClick: () => {
          unstack(sheetId, lineId)
          toast.dismiss(lineId)
          undo()
        },
      },
      onDismiss: () => unstack(sheetId, lineId),
    })
    return
  }
  if (!watching) {
    watching = true
    onUnitWrite(sheetChanged)
  }
  standing.add(sheetId)
  toast(message, {
    id: toastId(sheetId),
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

/**
 * The player left a sheet: every line that is about it goes with it (r3 B3).
 * Its Undo, pressed from another page, would change a sheet nobody is looking
 * at, and a rule-break line would read as the sheet now on screen.
 */
export function leaveSheet(sheetId: string): void {
  sheetChanged(sheetId)
  for (const lineId of stacked.get(sheetId) ?? []) toast.dismiss(lineId)
  stacked.delete(sheetId)
  dismissChangeUndo(sheetId)
  dismissRuleBreaks(sheetId)
}
