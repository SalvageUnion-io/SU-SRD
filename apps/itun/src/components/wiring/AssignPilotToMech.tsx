/**
 * AssignPilotToMech — button that opens a pilot selector dialog, then creates
 * a mech-to-pilot SoftLink on confirm.
 *
 * Dialog UI is an inline ModalShell with a radio list (the SelectorDialog
 * grammar, absorbed per ruleset §6); this component owns the assign flow state.
 *
 * Props:
 *   mechId     — id of the mech being assigned a pilot
 *   store      — injectable store for testability (omit in production)
 *   onAssigned — optional callback fired after the link is created
 *   className  — optional class override for the trigger button
 */

import { useState } from 'react'
import { Button, FieldError, ModalShell, Radio } from 'component-lib'

import { usePilots } from '../../hooks/queries'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'
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
  const zustandPilots = usePilots()
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
        size="compact"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign pilot to mech"
      >
        Assign Pilot
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title="Assign Pilot to Mech"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {pilots.length === 0 ? (
            <p className="font-body text-sm text-wk-muted">
              No pilots found. Create a pilot first.
            </p>
          ) : (
            <div className="space-y-2">
              {pilots.map((pilot) => (
                <Radio
                  key={pilot.id}
                  name="pilot-select"
                  value={pilot.id}
                  checked={selectedPilotId === pilot.id}
                  onChange={() => setSelectedPilotId(pilot.id)}
                  label={pilot.name}
                  description={pilot.callsign ? `“${pilot.callsign}”` : undefined}
                />
              ))}
            </div>
          )}

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => void handleConfirm()}
              disabled={pending || pilots.length === 0}
              aria-label="Confirm pilot assignment"
            >
              {pending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
