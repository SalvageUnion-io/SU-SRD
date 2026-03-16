import type { ReferenceEntityControl } from 'suref-react'
import { PilotListingCard } from './PilotListingCard'
import { PilotSheet } from './PilotSheet'
import type { ComradeEntry } from '../../lib/comradeUtils'
import type { PilotEditConfig } from '../../hooks/usePilotSheet'
import type {
  PilotRow,
  MechRow,
  CrawlerRow,
  EntityRefRow,
  DowntimeRecordRow,
} from '../../types/common'
import type { SURefChassis, SURefClass } from 'salvageunion-reference'

type PlayerPilotDisplayProps = {
  pilot: PilotRow
  listing?: boolean
  compact?: boolean
  controls?: ReferenceEntityControl[]
  // Listing enrichment
  abilityCount?: number
  mech?: MechRow | null
  // Sheet data (only needed when !listing)
  pilotClass?: SURefClass
  pilotRefs?: EntityRefRow[]
  mechRefs?: EntityRefRow[]
  mechChassis?: SURefChassis
  mechLoading?: boolean
  cardColor?: string
  pilotClassName?: string
  pilotClassAssetUrl?: string
  chassisName?: string
  patternName?: string
  comrades?: ComradeEntry[]
  crawler?: CrawlerRow | null
  crawlerTlStats?: { max_sp: number; upkeep: number; upgrade_cost: number | null }
  activeDowntime?: DowntimeRecordRow | null
  editConfig?: PilotEditConfig
}

export function PlayerPilotDisplay({
  pilot,
  listing = true,
  compact = true,
  controls,
  abilityCount,
  mech,
  pilotClass,
  pilotRefs,
  mechRefs,
  mechChassis,
  mechLoading,
  cardColor,
  pilotClassName,
  pilotClassAssetUrl,
  chassisName,
  patternName,
  comrades,
  crawler,
  crawlerTlStats,
  activeDowntime,
  editConfig,
}: PlayerPilotDisplayProps) {
  if (listing) {
    return (
      <PilotListingCard
        pilot={pilot}
        compact={compact}
        controls={controls}
        abilityCount={abilityCount}
        mech={mech}
        cardColor={cardColor}
        pilotClassName={pilotClassName}
        chassisName={chassisName}
        patternName={patternName}
      />
    )
  }

  return (
    <PilotSheet
      pilot={pilot}
      compact={compact}
      controls={controls}
      abilityCount={abilityCount}
      mech={mech}
      pilotClass={pilotClass}
      pilotRefs={pilotRefs}
      mechRefs={mechRefs}
      mechChassis={mechChassis}
      mechLoading={mechLoading}
      cardColor={cardColor}
      pilotClassName={pilotClassName}
      pilotClassAssetUrl={pilotClassAssetUrl}
      chassisName={chassisName}
      patternName={patternName}
      comrades={comrades}
      crawler={crawler}
      crawlerTlStats={crawlerTlStats}
      activeDowntime={activeDowntime}
      editConfig={editConfig}
    />
  )
}
