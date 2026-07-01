/**
 * AssignPilotToMech — button that opens a pilot selector dialog, then creates
 * a mech-to-pilot SoftLink on confirm.
 *
 * Dialog UI is the shared SelectorDialog (ModalShell-based); this component
 * only owns the assign flow state.
 *
 * Props:
 *   mechId     — id of the mech being assigned a pilot
 *   store      — injectable store for testability (omit in production)
 *   onAssigned — optional callback fired after the link is created
 *   className  — optional class override for the trigger button
 */

import { useState } from 'react'
import { Btn } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import type { Pilot } from '../../lib/schemas/pilot'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'
import { SelectorDialog } from '../shared/SelectorDialog'
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
      <Btn
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign pilot to mech"
      >
        Assign Pilot
      </Btn>

      <SelectorDialog
        open={open}
        title="Assign Pilot to Mech"
        radioGroupName="pilot-select"
        options={pilots.map((pilot) => ({
          id: pilot.id,
          label: pilot.name,
          sublabel: pilot.callsign ? `“${pilot.callsign}”` : undefined,
        }))}
        emptyMessage="No pilots found. Create a pilot first."
        selectedId={selectedPilotId}
        onSelect={setSelectedPilotId}
        confirmAriaLabel="Confirm pilot assignment"
        pending={pending}
        error={error}
        onConfirm={() => void handleConfirm()}
        onClose={closeDialog}
      />
    </>
  )
}
