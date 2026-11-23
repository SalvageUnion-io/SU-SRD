/**
 * A sheet's Undo (r4 E2, E3): the Change Log's button, Ctrl+Z and the ⋯
 * menu's "Undo last change" all take ONE change back on the sheet as it is
 * now (`reverseChange`), in a write that names the change (`sheetUndo`), so
 * the log marks it taken back and the next press steps one change further.
 *
 * Ctrl+Z and "Undo last change" reach only the changes made in this tab
 * (`madeInThisTab`, r5 C2): another tab's change is that tab's to take back,
 * or the Change Log's. What this tab undid, Ctrl+Shift+Z or Ctrl+Y (and the
 * undo's own Redo) puts back, newest first, until the sheet's next change;
 * meanwhile the ⋯ menu offers it too, by name ("Redo: add Armour Plating",
 * r7 G8), so Redo never lives only in a toast that fades.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { useEffect, useRef, useState } from 'react'
import { toast } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { sheetRedo, sheetUndo } from '../../replica/provenance'
import { roomOf } from '../../replica/roomSocket'
import type { UnitsState } from '../../replica/units'
import { madeInThisTab, onUnitWrite } from '../../replica/units'
import type { EntityLogRow } from '../../rooms/ops'
import type { LogChange, LogDefaults, Reversal } from './changeLog.model'
import { changeWhat, lastUndoable, logChanges, reversal, reverseChange } from './changeLog.model'
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

/**
 * A key press that belongs to a text field's own undo, never the sheet's. A
 * picker's search box with nothing in it has nothing of its own to undo, so
 * there Ctrl+Z takes back the part just added (r5 C1, C5).
 */
const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) &&
  !(
    target instanceof HTMLInputElement &&
    target.value === '' &&
    target.closest('.su-searcher__search') !== null
  )

/** What a key press asks of the sheet: Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo. */
export function sheetKey(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>
): 'undo' | 'redo' | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !event.shiftKey) return 'redo'
  return null
}

/** The change this tab's Undo takes back next: the newest it made that still stands. */
export const lastUndoableHere = (
  changes: readonly LogChange[],
  taken: ReadonlySet<string> = new Set()
): LogChange | undefined =>
  lastUndoable(changes.filter((each) => !taken.has(each.id) && madeInThisTab(each.id)))

/** A change this tab undid: the change, its words, and the fields it put back. */
type Undone = { change: LogChange; did: Reversal; prior: Record<string, unknown> }

export function useSheetUndo({ kind, id, gameId, storeState, defaults, blocked }: SheetUndoInput) {
  // Changes this sheet has taken back whose write the log may not show yet:
  // two quick presses step back twice, never the same change twice.
  const taken = useRef(new Set<string>())
  const busy = useRef(false)
  // What Redo puts back, newest last; the sheet's next change (not ours) clears it.
  const redos = useRef<Undone[]>([])
  // What the next Redo puts back, in words where the log has them; null with
  // nothing to redo. The ⋯ menu offers it by name (r7 G8).
  const [redoNext, setRedoNext] = useState<{ what: string | undefined } | null>(null)
  const setRedos = (list: Undone[]): void => {
    redos.current = list
    const top = list.at(-1)
    setRedoNext(top ? { what: changeWhat(top.change) } : null)
  }
  const ours = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `setRedos` writes a ref and a state setter
  useEffect(
    () =>
      onUnitWrite((written) => {
        if (written === id && !ours.current && redos.current.length > 0) setRedos([])
      }),
    [id]
  )

  const write = (patch: Record<string, unknown>, meta: Parameters<UnitsState['update']>[3]) => {
    ours.current = true
    try {
      return storeState.update(kind, id, patch, meta)
    } finally {
      ours.current = false
    }
  }

  const redo = (undone: Undone): void => {
    setRedos(redos.current.filter((each) => each !== undone))
    taken.current.delete(undone.change.id)
    runWrite(() => write(undone.prior, sheetRedo(undone.change.id)))
    undoToast(buildSheetCopy('changeRedone'), () => void reverse(undone.change, undone.did), id)
  }

  const reverse = (change: LogChange, did: Reversal): Promise<unknown> => {
    const now = storeState.get(kind, id) as Record<string, unknown> | null
    if (now === null) return Promise.resolve()
    const back = reverseChange(change, now)
    const prior = Object.fromEntries(Object.keys(back).map((field) => [field, now[field]]))
    taken.current.add(change.id)
    const done = write(back, sheetUndo(change.id))
    runWrite(() => done)
    const undone: Undone = { change, did, prior }
    setRedos([...redos.current, undone])
    undoToast(did.done, () => redo(undone), id, { label: buildSheetCopy('redo') })
    return done.catch(() => undefined)
  }

  const redoLast = (): void => {
    if (blocked) return
    const undone = redos.current.at(-1)
    if (undone) redo(undone)
    else toast(buildSheetCopy('nothingToRedo'), { id: `undo-none:${id}` })
  }

  // What the next Undo takes back, in words, once asked (`look`): the ⋯ menu names it (r6 E15).
  const [next, setNext] = useState<string | undefined>(undefined)
  const look = async (): Promise<void> => {
    const room = blocked ? null : roomOf(gameId)
    if (room === null) return
    try {
      const rows = (await room.act('changeLog.forEntity', { entityId: id })) as EntityLogRow[]
      const change = lastUndoableHere(logChanges(rows, defaults), taken.current)
      setNext(change ? changeWhat(change) : undefined)
    } catch {
      setNext(undefined)
    }
  }

  const undoLast = async (): Promise<void> => {
    if (blocked || busy.current) return
    const room = roomOf(gameId)
    if (room === null) return
    busy.current = true
    try {
      const rows = (await room.act('changeLog.forEntity', { entityId: id })) as EntityLogRow[]
      const change = lastUndoableHere(logChanges(rows, defaults), taken.current)
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

  // Ctrl+Z (Cmd+Z), Ctrl+Shift+Z and Ctrl+Y anywhere on the sheet but in a
  // text field, which keeps its own.
  const latest = useRef({ undoLast, redoLast })
  latest.current = { undoLast, redoLast }
  useEffect(() => {
    if (blocked) return undefined
    const onKey = (event: KeyboardEvent) => {
      const asked = sheetKey(event)
      if (asked === null || event.defaultPrevented || typing(event.target)) return
      event.preventDefault()
      if (asked === 'undo') void latest.current.undoLast()
      else latest.current.redoLast()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [blocked])

  return { reverse, undoLast, redoLast, next, redoNext, look }
}
