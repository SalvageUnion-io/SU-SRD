import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { SURefEntity } from 'salvageunion-reference'
import { EntityDisplay, SectionSeparator, navigateControl } from 'suref-react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Skeleton } from '../ui/skeleton'
import type { PilotRow } from '../../types/common'

type PilotMechSectionProps = {
  pilot: PilotRow
  readOnly?: boolean
  mech?: { id: string; pattern_name: string | null } | null
  mechChassis?: SURefEntity
  mechLoading: boolean
}

export function PilotMechSection({
  pilot,
  readOnly,
  mech,
  mechChassis,
  mechLoading,
}: PilotMechSectionProps) {
  const navigate = useNavigate()

  const handleNavigateToMechBay = useCallback(() => {
    navigate({ to: '/pilots/$pilotId/mech-bay', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  return (
    <div className="space-y-3">
      <SectionSeparator label="Mech" fontSize="text-sm" />

      {!pilot.mech_id ? (
        readOnly ? (
          <p className="text-sm text-su-grey-dark">No mech assigned.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-su-grey-light/50 p-6">
            <p className="text-sm text-su-grey-dark">No mech assigned yet.</p>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: '/pilots/$pilotId/create-mech', params: { pilotId: pilot.id } })
              }
              className="font-mono text-xs uppercase"
            >
              <Plus className="h-4 w-4" />
              Create Starting Mech
            </Button>
          </div>
        )
      ) : mechLoading ? (
        <Skeleton className="h-[40px] rounded-md" />
      ) : mech && mechChassis ? (
        <EntityDisplay
          data={mechChassis}
          listing
          compact
          patternOverride={{
            name: mech.pattern_name ?? 'Unnamed Mech',
            systems: [],
            modules: [],
          }}
          controls={[navigateControl(handleNavigateToMechBay)]}
        />
      ) : null}
    </div>
  )
}
