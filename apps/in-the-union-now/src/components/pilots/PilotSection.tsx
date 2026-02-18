import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { findChassisById, findClassName } from '../../lib/entityHelpers'
import {
  DisplayCard,
  CardHeader,
  ValueDisplay,
  SectionSeparator,
  Text,
  navigateControl,
} from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePilots, usePilotAbilityCounts } from '../../hooks/usePilots'
import { useMech } from '../../hooks/useMechs'
import { Skeleton } from '../ui/skeleton'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import type { PilotRow } from '../../types/common'

export function PilotSection() {
  const user = useAuthStore((s) => s.user)
  const { data: pilots, isLoading } = usePilots(user?.id)

  const pilotIds = useMemo(() => pilots?.map((p) => p.id) ?? [], [pilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Pilots" fontSize="text-sm" />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pilots?.map((pilot) => (
            <PilotListing
              key={pilot.id}
              pilot={pilot}
              abilityCount={abilityCounts?.[pilot.id] ?? 0}
            />
          ))}
          <NewPilotSlot />
        </div>
      )}
    </div>
  )
}

function PilotListing({ pilot, abilityCount }: { pilot: PilotRow; abilityCount: number }) {
  const navigate = useNavigate()
  const { data: mech } = useMech(pilot.mech_id ?? undefined)

  const pilotClassName = useMemo(() => findClassName(pilot.class_ref), [pilot.class_ref])

  const chassisName = useMemo(() => {
    if (!mech) return undefined
    const chassis = findChassisById(mech.chassis_ref)
    return chassis?.name
  }, [mech])

  const patternName = mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined

  const handleNavigate = useCallback(() => {
    navigate({ to: '/pilots/$pilotId', params: { pilotId: pilot.id } })
  }, [navigate, pilot.id])

  const controls = useMemo(() => [navigateControl(handleNavigate)], [handleNavigate])

  const headerContent = (
    <CardHeader
      title={pilot.callsign}
      subtitle={
        <div className="flex flex-wrap items-center gap-1">
          <ValueDisplay label="Class" value={pilotClassName} compact />
          <ValueDisplay label="Abilities" value={abilityCount} compact />
          {chassisName && (
            <span className="inline-flex shrink-0 cursor-default whitespace-nowrap border border-su-black">
              <Text
                variant="pseudoheader"
                as="span"
                className="text-xs font-normal uppercase"
                style={{ backgroundColor: 'rgb(122, 151, 138)' }}
              >
                {chassisName}
              </Text>
              {patternName && (
                <Text variant="pseudoheader" as="span" className="text-xs font-normal uppercase">
                  {patternName}
                </Text>
              )}
            </span>
          )}
        </div>
      }
      compact
    />
  )

  return (
    <DisplayCard
      headerBg="bg-su-orange"
      headerContent={headerContent}
      mode="listing"
      controls={controls}
    />
  )
}

function NewPilotSlot() {
  return (
    <Link to="/pilots/new" className="block">
      <div className={EMPTY_SLOT_CLASSES}>
        <Plus className="h-4 w-4" />
        <span className="font-mono text-sm font-semibold uppercase">New Pilot</span>
      </div>
    </Link>
  )
}
