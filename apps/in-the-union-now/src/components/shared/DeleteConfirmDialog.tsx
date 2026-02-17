import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-su-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-orange">Delete {entityType}</DialogTitle>
          <DialogDescription className="text-su-grey-dark">
            Are you sure you want to delete <strong className="text-su-white">{entityName}</strong>?
            This will remove all associated data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
