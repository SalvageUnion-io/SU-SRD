/**
 * DeleteConfirmDialog — modal that confirms a destructive delete.
 *
 * Opens when `open` is true. Calls `onConfirm` on confirmation, `onCancel` on
 * dismissal. The parent is responsible for calling entityStore.delete() inside
 * onConfirm.
 *
 * Accessibility: role="dialog" with aria-modal + aria-labelledby. Pressing
 * Escape on the backdrop keyDown handler dismisses the dialog.
 */

import type { KeyboardEvent } from 'react'

import { Button } from '../ui/button'

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
  if (!open) return null

  function handleBackdropKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    /* Backdrop — keyboard listener for Escape-to-dismiss. The interactive
       content lives inside the dialog panel. */
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onKeyDown={handleBackdropKeyDown}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl"
      >
        <h2 id="delete-dialog-title" className="mb-2 text-lg font-semibold">
          Delete {entityName}?
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This action cannot be undone. {entityName} will be permanently removed.
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
