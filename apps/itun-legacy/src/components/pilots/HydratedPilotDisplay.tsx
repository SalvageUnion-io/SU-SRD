import type { ReferenceEntityControl } from 'suref-react'
import { usePilotSheet } from '../../hooks/usePilotSheet'
import { PageSkeleton } from '../shared/PageSkeleton'
import { NotFoundState } from '../shared/NotFoundState'
import { Skeleton } from '../ui/skeleton'
import { PilotListingCard } from './PilotListingCard'
import { PilotSheet } from './PilotSheet'

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

  if (listing) {
    return (
      <PilotListingCard
        pilot={sheet.pilot}
        compact={compact}
        controls={controls}
        abilityCount={sheet.abilityCount}
        mech={sheet.mech}
        cardColor={sheet.cardColor}
        pilotClassName={sheet.pilotClassName}
        chassisName={sheet.chassisName}
        patternName={sheet.patternName}
      />
    )
  }

  return (
    <PilotSheet
      pilot={sheet.pilot}
      compact={compact}
      controls={controls}
      abilityCount={sheet.abilityCount}
      mech={sheet.mech}
      pilotClass={sheet.pilotClass}
      pilotRefs={sheet.pilotRefs}
      mechRefs={sheet.mechRefs}
      mechChassis={sheet.mechChassis}
      cardColor={sheet.cardColor}
      pilotClassName={sheet.pilotClassName}
      pilotClassAssetUrl={sheet.pilotClassAssetUrl}
      chassisName={sheet.chassisName}
      patternName={sheet.patternName}
      comrades={sheet.comrades}
      crawler={sheet.crawler}
      crawlerTlStats={sheet.crawlerTlStats}
      activeDowntime={sheet.activeDowntime}
      editConfig={sheet.editConfig}
    />
  )
}
