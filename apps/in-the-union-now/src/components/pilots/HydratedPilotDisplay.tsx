import type { ReferenceEntityControl } from 'suref-react'
import { usePilotSheet } from '../../hooks/usePilotSheet'
import { PageSkeleton } from '../shared/PageSkeleton'
import { NotFoundState } from '../shared/NotFoundState'
import { Skeleton } from '../ui/skeleton'
import { PlayerPilotDisplay } from './PlayerPilotDisplay'

type HydratedPilotDisplayProps = {
  pilotId: string
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
}

export function HydratedPilotDisplay({
  pilotId,
  listing = false,
  compact = false,
  controls,
}: HydratedPilotDisplayProps) {
  const sheet = usePilotSheet(pilotId)

  if (sheet.isLoading) {
    return listing && compact ? <Skeleton className="h-[40px] rounded-md" /> : <PageSkeleton />
  }

  if (sheet.error || !sheet.pilot || !sheet.access?.canView) {
    return <NotFoundState message="Pilot not found." />
  }

  return (
    <PlayerPilotDisplay
      pilot={sheet.pilot}
      listing={listing}
      compact={compact}
      controls={controls}
      abilityCount={sheet.abilityCount}
      mech={sheet.mech}
      pilotRefs={sheet.pilotRefs}
      mechRefs={sheet.mechRefs}
      mechChassis={sheet.mechChassis}
      mechLoading={sheet.mechLoading}
      cardColor={sheet.cardColor}
      pilotClassName={sheet.pilotClassName}
      pilotClass={sheet.pilotClass}
      pilotClassAssetUrl={sheet.pilotClassAssetUrl}
      chassisName={sheet.chassisName}
      patternName={sheet.patternName}
      comrades={sheet.comrades}
      editConfig={listing ? undefined : sheet.editConfig}
    />
  )
}
