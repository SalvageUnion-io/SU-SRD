import type { ReferenceEntityControl } from 'suref-react'
import { PilotListingCard } from './PilotListingCard'
import type { PilotRow, MechRow } from '../../types/common'

type PilotCompactCardProps = {
  pilot: PilotRow
  controls?: ReferenceEntityControl[]
  abilityCount?: number
  mech?: MechRow | null
  cardColor?: string
  pilotClassName?: string
  chassisName?: string
  patternName?: string
}

/**
 * Summary card: a non-compact listing card. Used when a pilot should stand out
 * visually more than in a dense listing (e.g. the dashboard pilot section),
 * but without committing to the full interactive sheet.
 *
 * Shares rendering with `PilotListingCard` — this is the `compact={false}` preset.
 */
export function PilotCompactCard(props: PilotCompactCardProps) {
  return <PilotListingCard {...props} compact={false} />
}
