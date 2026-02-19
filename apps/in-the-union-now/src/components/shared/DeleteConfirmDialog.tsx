import { Text } from 'suref-react'
import { Button } from '../ui/button'
import { ModalShell } from './ModalShell'

type DeleteConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entityType,
  entityName,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${entityType}`}
      description={`Confirm deletion of ${entityName}`}
      headerBg="bg-su-rust"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-su-dark p-4">
        <Text as="p" className="text-sm text-su-grey-light">
          Are you sure you want to delete <strong className="text-su-white">{entityName}</strong>?
          This will remove all associated data. This action cannot be undone.
        </Text>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
