/**
 * DeleteConfirmDialog — modal that confirms a destructive delete.
 *
 * Opens when `open` is true. Calls `onConfirm` on confirmation, `onCancel` on
 * dismissal. The parent is responsible for calling entityStore.delete() inside
 * onConfirm.
 *
 * Rendered through a ModalShell (portal, focus trap, Escape/backdrop dismiss).
 */

import { Button, ModalShell } from 'component-lib'

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
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title={`Delete ${entityName}?`}
      headerBg="bg-su-rust"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        <div className="font-body text-sm text-wk-muted">
          This action cannot be undone. {entityName} will be permanently removed.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
