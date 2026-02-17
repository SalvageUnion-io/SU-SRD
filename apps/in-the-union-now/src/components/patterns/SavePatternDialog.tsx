import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

type SavePatternDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  onConfirm: (name: string) => void
  isSaving?: boolean
}

export function SavePatternDialog({
  open,
  onOpenChange,
  defaultName,
  onConfirm,
  isSaving,
}: SavePatternDialogProps) {
  const [name, setName] = useState(defaultName)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onConfirm(name.trim())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setName(defaultName)
        onOpenChange(v)
      }}
    >
      <DialogContent className="bg-su-dark sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-su-orange">Save to My Patterns</DialogTitle>
            <DialogDescription className="text-su-grey-dark">
              Save this mech&rsquo;s current loadout as a reusable pattern.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Pattern name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-su-dark-lighter text-su-white"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Saving...' : 'Save Pattern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
