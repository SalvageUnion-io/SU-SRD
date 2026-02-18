import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { DisplayCard, Text } from 'suref-react'
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <DialogPrimitive.Content className="relative w-full max-w-md px-4 outline-none">
            <DialogPrimitive.Title className="sr-only">Delete {entityType}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Confirm deletion of {entityName}
            </DialogPrimitive.Description>

            <DisplayCard
              headerBg="bg-su-rust"
              bodyPadding="p-0"
              headerContent={
                <div className="flex w-full items-center justify-between gap-2">
                  <Text as="span" variant="pseudoheader" className="text-xl text-su-white">
                    Delete {entityType}
                  </Text>
                  <DialogPrimitive.Close className="flex shrink-0 cursor-pointer items-center justify-center rounded p-1 text-su-white/60 transition-colors hover:bg-su-black/20 hover:text-su-white">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>
              }
            >
              <div className="flex flex-col gap-4 bg-su-dark p-4">
                <Text as="p" className="text-sm text-su-grey-light">
                  Are you sure you want to delete{' '}
                  <strong className="text-su-white">{entityName}</strong>? This will remove all
                  associated data. This action cannot be undone.
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
            </DisplayCard>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
