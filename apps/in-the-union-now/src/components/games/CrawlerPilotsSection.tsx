import { useMemo } from 'react'
import { SectionSeparator, Text } from 'suref-react'
import { usePilotsForCrawler, usePilotAbilityCounts } from '../../hooks/usePilots'
import { Skeleton } from '../ui/skeleton'
import { PlayerPilotDisplay } from '../pilots/PlayerPilotDisplay'

type CrawlerPilotsSectionProps = {
  crawlerId: string
}

export function CrawlerPilotsSection({ crawlerId }: CrawlerPilotsSectionProps) {
  const { data: pilots, isLoading } = usePilotsForCrawler(crawlerId)

  const pilotIds = useMemo(() => pilots?.map((p) => p.id) ?? [], [pilots])
  const { data: abilityCounts } = usePilotAbilityCounts(pilotIds)

  return (
    <div className="flex flex-col gap-3">
      <SectionSeparator label="Pilots" />
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
              <PlayerPilotDisplay pilot={pilot} abilityCount={abilityCounts?.[pilot.id] ?? 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
