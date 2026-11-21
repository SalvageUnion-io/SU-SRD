/** A shelf row's ⋯ menu: its Rename (and what the dialog needs) and its Delete. */
import type { HeaderMenuItem } from '../../components/index'
import { buildShelvesCopy } from '../../messages/build-shelves'

/** What is being renamed: its name now, the field's label, and the write. */
export type RenameSubject = {
  name: string
  label: string
  save: (name: string) => Promise<unknown>
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

/** The menu's `Delete…`, in its own group; without `onSelect` it is disabled. */
export const deleteItem = (onSelect: (() => void) | undefined): HeaderMenuItem => ({
  id: 'delete',
  label: buildShelvesCopy('deleteMenu'),
  tone: 'danger',
  onSelect,
})
