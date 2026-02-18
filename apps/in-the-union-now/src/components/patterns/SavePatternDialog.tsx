import { useState } from 'react'
import { Input } from '../ui/input'
import { ModalShell } from '../shared/ModalShell'

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

  function handleOpenChange(v: boolean) {
    if (!v) setName(defaultName)
    onOpenChange(v)
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={handleOpenChange}
      title="Save to My Patterns"
      subtitle="Save this mech's current loadout as a reusable pattern."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-su-white p-4">
        <Input
          placeholder="Pattern name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-su-grey-dark/40 bg-su-white text-su-black placeholder:text-su-grey-dark"
        />
        <div className="flex items-center justify-end gap-2 border-t border-su-grey-light/30 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="cursor-pointer px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-black/50 transition-colors hover:text-su-black disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSaving}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-su-green px-3 py-1.5 font-mono text-sm font-semibold uppercase text-su-white transition-colors hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Pattern'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
