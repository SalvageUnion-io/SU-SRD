import { useMemo } from 'react'
import { Text } from 'suref-react'
import { usePilotsForCrawler, usePilotAbilityCounts } from '../../hooks/usePilots'
import { useMechMap } from '../../hooks/useMechMap'
import { Skeleton } from '../ui/skeleton'
import { PilotListingCard } from '../pilots/PilotListingCard'

type CrawlerPilotsSectionProps = {
  crawlerId: string
}

export function CrawlerPilotsSection({ crawlerId }: CrawlerPilotsSectionProps) {
  const { data: pilots, isLoading } = usePilotsForCrawler(crawlerId)

  const pilotIds = useMemo(() => pilots?.map((p) => p.id) ?? [], [pilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  const mechIds = useMemo(
    () => (pilots ?? []).map((p) => p.mech_id).filter((id): id is string => !!id),
    [pilots]
  )
  const { mechMap } = useMechMap(mechIds)

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Skeleton className="h-[40px] rounded-md" />
          <Skeleton className="h-[40px] rounded-md" />
        </div>
      ) : !pilots?.length ? (
        <Text variant="default" as="p" className="text-sm text-su-white/40">
          No pilots assigned to this crawler.
        </Text>
      ) : (
        <div className="columns-1 gap-2 space-y-2 md:columns-2">
          {pilots.map((pilot) => (
            <div key={pilot.id} className="break-inside-avoid">
              <PilotListingCard
                pilot={pilot}
                abilityCount={abilityCounts?.[pilot.id] ?? 0}
                mech={pilot.mech_id ? (mechMap.get(pilot.mech_id) ?? null) : null}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
