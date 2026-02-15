import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'

type DeletePatternDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patternName: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeletePatternDialog({
  open,
  onOpenChange,
  patternName,
  onConfirm,
  isDeleting,
}: DeletePatternDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-su-dark sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-su-orange">Delete Pattern</DialogTitle>
          <DialogDescription className="text-su-grey-dark">
            Are you sure you want to delete <strong className="text-su-white">{patternName}</strong>
            ? This action cannot be undone.
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
