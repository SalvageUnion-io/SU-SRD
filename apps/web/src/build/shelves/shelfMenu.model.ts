/** A shelf row's ⋯ menu: its Rename (and what the dialog needs) and its Delete. */
import type { HeaderMenuItem } from '../../components/index'
import { buildShelvesCopy } from '../../messages/build-shelves'

/**
 * What is being renamed: its name now, the field's label, and the write. A
 * pilot goes by two (`also`: its name under its callsign, r4 E20), and both
 * are kept filled.
 */
export type RenameSubject = {
  name: string
  label: string
  /** The dialog's title names this where it is not `name` alone (a pilot's `GHOST · Mara Voss`). */
  title?: string
  also?: { name: string; label: string }
  save: (name: string, also?: string) => Promise<unknown>
}

/** The menu's `Rename…`; without `open` (no write could land) it is disabled. */
export const renameItem = (
  subject: RenameSubject,
  open: ((subject: RenameSubject) => void) | undefined
): HeaderMenuItem => ({
  id: 'rename',
  label: buildShelvesCopy('renameMenu'),
  onSelect: open ? () => open(subject) : undefined,
})

/**
 * The menu's `Delete…`, in its own group; without `onSelect` it is disabled.
 * `undoable`: the delete asks nothing and its notice undoes it (r6 E3), so it
 * reads `Delete`, with no ellipsis for a question that never comes.
 */
export const deleteItem = (
  onSelect: (() => void) | undefined,
  undoable = false
): HeaderMenuItem => ({
  id: 'delete',
  label: buildShelvesCopy(undoable ? 'deleteNow' : 'deleteMenu'),
  tone: 'danger',
  onSelect,
})
