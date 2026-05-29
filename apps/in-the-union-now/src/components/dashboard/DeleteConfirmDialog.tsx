/**
 * DeleteConfirmDialog — modal that confirms a destructive delete.
 *
 * Opens when `open` is true. Calls `onConfirm` on confirmation, `onCancel` on
 * dismissal. The parent is responsible for calling entityStore.delete() inside
 * onConfirm.
 *
 * Accessibility: role="dialog" with aria-modal + aria-labelledby. Focus is
 * trapped inside and restored to the trigger on close. Escape dismisses.
 */

import { useRef } from 'react'

import { useDialogA11y } from '../shared/useDialogA11y'
import { Button } from '../ui/button'

type DeleteConfirmDialogProps = {
  open: boolean
  entityName: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmDialogInner({
  entityName,
  onConfirm,
  onCancel,
}: Omit<DeleteConfirmDialogProps, 'open'>) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose: onCancel })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {/* Dialog panel */}
      <div
        ref={dialogRef}
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

export function DeleteConfirmDialog({
  open,
  entityName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!open) return null
  return (
    <DeleteConfirmDialogInner entityName={entityName} onConfirm={onConfirm} onCancel={onCancel} />
  )
}
