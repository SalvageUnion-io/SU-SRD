import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { SectionSeparator } from 'suref-react'
import { useAuthStore } from '../../stores/authStore'
import { usePilots, usePilotAbilityCounts } from '../../hooks/usePilots'
import { useMechMap } from '../../hooks/useMechMap'
import { Skeleton } from '../ui/skeleton'
import { PlayerPilotDisplay } from './PlayerPilotDisplay'

export function PilotSection() {
  const user = useAuthStore((s) => s.user)
  const { data: pilots, isLoading } = usePilots(user?.id)

  const pilotIds = useMemo(() => pilots?.map((p) => p.id) ?? [], [pilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  const mechIds = useMemo(
    () => (pilots ?? []).map((p) => p.mech_id).filter((id): id is string => !!id),
    [pilots]
  )
  const { mechMap } = useMechMap(mechIds)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Pilots">
        <Link
          to="/pilots/new"
          className="flex items-center gap-1 font-mono text-xs font-semibold uppercase text-su-fg-muted transition-colors hover:text-su-fg"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      </SectionSeparator>

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
              compact={false}
              abilityCount={abilityCounts?.[pilot.id] ?? 0}
              mech={pilot.mech_id ? (mechMap.get(pilot.mech_id) ?? null) : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
