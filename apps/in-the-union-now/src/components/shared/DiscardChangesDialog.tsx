import { Text } from 'suref-react'
import { Button } from '../ui/button'
import { ModalShell } from './ModalShell'

type DiscardChangesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function DiscardChangesDialog({ open, onOpenChange, onConfirm }: DiscardChangesDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Discard Changes"
      description="Confirm discarding unsaved changes"
      headerBg="bg-su-orange"
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-su-dark p-4">
        <Text as="p" className="text-sm text-su-grey-light">
          Are you sure? Unsaved changes will be lost.
        </Text>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Keep Editing
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Discard
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
