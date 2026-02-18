import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay, SectionSeparator, useChassisPatternConfig } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { Plus, Wrench } from 'lucide-react'
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
        <MechListing
          mechChassis={mechChassis}
          patternName={mech.pattern_name ?? 'Unnamed Mech'}
          onNavigate={handleNavigateToMechBay}
        />
      ) : null}
    </div>
  )
}

function MechListing({
  mechChassis,
  patternName,
  onNavigate,
}: {
  mechChassis: SURefEntity
  patternName: string
  onNavigate: () => void
}) {
  const patternOverride = useMemo(
    () => ({ name: patternName, systems: [] as [], modules: [] as [] }),
    [patternName]
  )
  const patternConfig = useChassisPatternConfig(mechChassis, patternOverride, true)

  return (
    <ReferenceEntityDisplay
      data={mechChassis}
      listing
      compact
      titleOverride={patternConfig?.titleOverride}
      subtitleExtra={patternConfig?.subtitleExtra}
      statsOverride={patternConfig?.statsOverride}
      primaryStatsOnly={patternConfig?.primaryStatsOnly}
      controls={[
        {
          key: 'mech-bay',
          icon: Wrench,
          onClick: onNavigate,
          ariaLabel: 'Open Mech Bay',
          variant: 'ghost' as const,
        } satisfies ReferenceEntityControl,
      ]}
    />
  )
}
