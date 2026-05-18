/**
 * AssignPilotToMech — button that opens a pilot selector dialog, then creates
 * a mech-to-pilot SoftLink on confirm.
 *
 * Props:
 *   mechId     — id of the mech being assigned a pilot
 *   store      — injectable store for testability (omit in production)
 *   onAssigned — optional callback fired after the link is created
 *   className  — optional class override for the trigger button
 */

import { useState } from 'react'

import { useEntityStore } from '../../stores/entityStore'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/** Extended injectable store that also exposes pilot listing. */
export type AssignPilotStore = SoftLinkStore & {
  pilots: Pilot[]
}

type AssignPilotToMechProps = {
  mechId: string
  /** Inject to avoid Zustand global in tests. */
  store?: AssignPilotStore
  onAssigned?: () => void
  className?: string
}

export function AssignPilotToMech({
  mechId,
  store,
  onAssigned,
  className,
}: AssignPilotToMechProps) {
  const [open, setOpen] = useState(false)
  const [selectedPilotId, setSelectedPilotId] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { assign } = useSoftLinks({ entityType: 'mech', entityId: mechId, store })

  // Subscribe to pilots from real store when not injected
  const zustandPilots = useEntityStore((s) => s.pilots)
  const pilots: Pilot[] = store ? store.pilots : zustandPilots

  function openDialog() {
    setSelectedPilotId('')
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setError(null)
  }

  async function handleConfirm() {
    if (!selectedPilotId) {
      setError('Please select a pilot.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await assign({ type: 'pilot', id: selectedPilotId })
      setOpen(false)
      onAssigned?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign pilot.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign pilot to mech"
      >
        Assign Pilot
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-pilot-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <h2 id="assign-pilot-title" className="mb-4 text-base font-semibold">
              Assign Pilot to Mech
            </h2>

            {pilots.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">
                No pilots found. Create a pilot first.
              </p>
            ) : (
              <div className="mb-4 space-y-2">
                {pilots.map((pilot) => (
                  <label
                    key={pilot.id}
                    className="flex cursor-pointer items-center gap-2 rounded border p-2 hover:bg-accent"
                  >
                    <input
                      type="radio"
                      name="pilot-select"
                      value={pilot.id}
                      checked={selectedPilotId === pilot.id}
                      onChange={() => setSelectedPilotId(pilot.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium">{pilot.name}</span>
                    {pilot.callsign && (
                      <span className="text-xs text-muted-foreground">
                        &ldquo;{pilot.callsign}&rdquo;
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeDialog} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirm}
                disabled={pending || pilots.length === 0}
                aria-label="Confirm pilot assignment"
              >
                {pending ? 'Assigning…' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
