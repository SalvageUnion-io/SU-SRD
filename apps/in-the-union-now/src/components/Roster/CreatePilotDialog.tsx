import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useCreatePilot } from '../../hooks/usePilot'
import { useNavigate } from '@tanstack/react-router'
import { cn } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'

export function CreatePilotDialog() {
  const [open, setOpen] = useState(false)
  const [callsign, setCallsign] = useState('')
  const [classRef, setClassRef] = useState<string | null>(null)
  const createPilot = useCreatePilot()
  const navigate = useNavigate()

  const classes = SalvageUnionReference.Classes.all()

  const handleCreate = async () => {
    if (!callsign.trim()) return

    const pilot = await createPilot.mutateAsync({
      callsign: callsign.trim(),
      class_ref: classRef,
    })

    setOpen(false)
    setCallsign('')
    setClassRef(null)
    navigate({ to: '/pilot/$id', params: { id: pilot.id } })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex h-full min-h-[120px] items-center justify-center rounded-xl border-2 border-dashed border-su-grey-light p-4 text-su-grey transition-colors hover:border-pilot hover:text-pilot">
          <div className="flex flex-col items-center gap-2">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">New Pilot</span>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--background)] p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold">New Pilot</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-su-grey-light/20">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="callsign">
                Callsign
              </label>
              <input
                id="callsign"
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="Enter callsign..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pilot"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Class</label>
              <div className="grid grid-cols-2 gap-2">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setClassRef(classRef === cls.id ? null : cls.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      classRef === cls.id
                        ? 'border-pilot bg-pilot/10 font-medium'
                        : 'border-[var(--border)] hover:border-pilot/50'
                    )}
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={!callsign.trim() || createPilot.isPending}
              className="w-full rounded-lg bg-pilot px-4 py-2 font-medium text-white transition-colors hover:bg-su-orange-dark disabled:opacity-50"
            >
              {createPilot.isPending ? 'Creating...' : 'Create Pilot'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
