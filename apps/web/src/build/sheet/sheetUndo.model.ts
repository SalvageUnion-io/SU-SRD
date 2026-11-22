/**
 * A sheet's Undo (r4 E2, E3): the Change Log's button, Ctrl+Z and the ⋯
 * menu's "Undo last change" all take ONE change back on the sheet as it is
 * now (`reverseChange`), in a write that names the change (`sheetUndo`), so
 * the log marks it taken back and the next press steps one change further.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { useEffect, useRef } from 'react'
import { toast } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { sheetRedo, sheetUndo } from '../../replica/provenance'
import { roomOf } from '../../replica/roomSocket'
import type { UnitsState } from '../../replica/units'
import type { EntityLogRow } from '../../rooms/ops'
import type { LogChange, LogDefaults, Reversal } from './changeLog.model'
import { lastUndoable, logChanges, reversal, reverseChange } from './changeLog.model'
import { undoToast } from './undoToast.model'

type SheetUndoInput = {
  kind: SheetKind
  id: string
  /** The room the unit's log is in: its Game's, or the account's (null). */
  gameId: string | null
  storeState: UnitsState
  defaults: LogDefaults
  /** No write could land (offline crawler, a read-only rendering): no Undo. */
  blocked: boolean
}

/** A key press that belongs to a text field's own undo, never the sheet's. */
const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function useSheetUndo({ kind, id, gameId, storeState, defaults, blocked }: SheetUndoInput) {
  // Changes this sheet has taken back whose write the log may not show yet:
  // two quick presses step back twice, never the same change twice.
  const taken = useRef(new Set<string>())
  const busy = useRef(false)

  const reverse = (change: LogChange, did: Reversal): Promise<unknown> => {
    const now = storeState.get(kind, id) as Record<string, unknown> | null
    if (now === null) return Promise.resolve()
    const back = reverseChange(change, now)
    const prior = Object.fromEntries(Object.keys(back).map((field) => [field, now[field]]))
    taken.current.add(change.id)
    const done = storeState.update(kind, id, back, sheetUndo(change.id))
    runWrite(() => done)
    undoToast(
      did.done,
      () => {
        taken.current.delete(change.id)
        runWrite(() => storeState.update(kind, id, prior, sheetRedo(change.id)))
      },
      id
    )
    return done.catch(() => undefined)
  }

  const undoLast = async (): Promise<void> => {
    if (blocked || busy.current) return
    const room = roomOf(gameId)
    if (room === null) return
    busy.current = true
    try {
      const rows = (await room.act('changeLog.forEntity', { entityId: id })) as EntityLogRow[]
      const change = lastUndoable(
        logChanges(rows, defaults).filter((each) => !taken.current.has(each.id))
      )
      if (!change) {
        toast(buildSheetCopy('nothingToUndo'), { id: `undo-none:${id}` })
        return
      }
      await reverse(change, reversal(change, defaults))
    } catch {
      toast(buildSheetCopy('undoNeedsConnection'), { id: `undo-none:${id}` })
    } finally {
      busy.current = false
    }
  }

  // Ctrl+Z (Cmd+Z) anywhere on the sheet but in a text field, which keeps its own.
  const latest = useRef(undoLast)
  latest.current = undoLast
  useEffect(() => {
    if (blocked) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey)) return
      if (event.shiftKey || event.altKey || event.defaultPrevented || typing(event.target)) return
      event.preventDefault()
      void latest.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [blocked])

  return { reverse, undoLast }
}
