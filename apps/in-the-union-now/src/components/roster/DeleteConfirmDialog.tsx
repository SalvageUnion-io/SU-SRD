/**
 * DeleteConfirmDialog — modal that confirms a destructive delete.
 *
 * Opens when `open` is true. Calls `onConfirm` on confirmation, `onCancel` on
 * dismissal. The parent is responsible for calling entityStore.delete() inside
 * onConfirm.
 *
 * Rendered through the shared ConfirmDialog (ModalShell-based: portal, focus
 * trap, Escape/backdrop dismiss).
 */

import { ConfirmDialog } from 'suref-react'

type DeleteConfirmDialogProps = {
  open: boolean
  entityName: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  entityName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={`Delete ${entityName}?`}
      danger
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      This action cannot be undone. {entityName} will be permanently removed.
    </ConfirmDialog>
  )
}
