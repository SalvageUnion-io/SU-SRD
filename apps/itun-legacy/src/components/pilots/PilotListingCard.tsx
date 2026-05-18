import { useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DisplayCard, CardHeader, ValueDisplay, navigateControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import { findChassisById, SalvageUnionReference } from 'salvageunion-reference'
import { PilotListingSplitHeader } from './PilotListingSplitHeader'
import type { PilotRow, MechRow } from '../../types/common'

type PilotListingCardProps = {
  pilot: PilotRow
  compact?: boolean
  controls?: ReferenceEntityControl[]
  abilityCount?: number
  mech?: MechRow | null
  cardColor?: string
  pilotClassName?: string
  chassisName?: string
  patternName?: string
}

export function PilotListingCard({
  pilot,
  compact = true,
  controls: controlsProp,
  abilityCount,
  mech,
  cardColor,
  pilotClassName: pilotClassNameProp,
  chassisName: chassisNameProp,
  patternName: patternNameProp,
}: PilotListingCardProps) {
  const navigate = useNavigate()

  const pilotClassName =
    pilotClassNameProp ?? SalvageUnionReference.get('classes', pilot.class_ref)?.name ?? 'Unknown'

  const chassisName = useMemo(() => {
    if (chassisNameProp !== undefined) return chassisNameProp
    if (!mech) return undefined
    return findChassisById(mech.chassis_ref)?.name
  }, [chassisNameProp, mech])

  const patternName =
    patternNameProp ?? (mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined)

  const handleNavigate = useCallback(() => {
    navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  const defaultControls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])

  const controls = controlsProp ?? defaultControls

  const headerContent = chassisName ? (
    <PilotListingSplitHeader
      callsign={pilot.callsign}
      pilotClassName={pilotClassName}
      abilityCount={abilityCount}
      chassisName={chassisName}
      patternName={patternName}
      compact={compact}
    />
  ) : (
    <CardHeader
      title={pilot.callsign}
      subtitle={
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="The" value={pilotClassName} compact={compact} />
        </div>
      }
      compact={compact}
    />
  )

  return (
    <DisplayCard
      headerBg={cardColor ?? 'bg-su-orange'}
      bodyPadding="p-4"
      compact={compact}
      listing
      headerContent={headerContent}
      controls={controls}
    />
  )
}
