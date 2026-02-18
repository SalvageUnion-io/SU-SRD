import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SectionSeparator } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePilots, usePilotAbilityCounts } from '../../hooks/usePilots'
import { Skeleton } from '../ui/skeleton'
import { EMPTY_SLOT_CLASSES } from '../patterns/emptySlotClasses'
import { PlayerPilotDisplay } from './PlayerPilotDisplay'

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
            <PlayerPilotDisplay
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
