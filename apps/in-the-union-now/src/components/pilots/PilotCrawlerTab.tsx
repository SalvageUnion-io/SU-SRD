import { Text } from 'suref-react'
import { useGameByCrawlerId } from '../../hooks/useGames'
import { HydratedCrawlerDisplay } from '../games/HydratedCrawlerDisplay'
import { Skeleton } from '../ui/skeleton'

type PilotCrawlerTabProps = {
  crawlerId: string | null
}

export function PilotCrawlerTab({ crawlerId }: PilotCrawlerTabProps) {
  const { data: game, isLoading } = useGameByCrawlerId(crawlerId ?? undefined)

  if (!crawlerId) {
    return (
      <Text as="p" className="text-sm text-su-grey-dark italic">
        No crawler assigned.
      </Text>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-[80px] rounded-md" />
  }

  if (!game) {
    return (
      <Text as="p" className="text-sm text-su-grey-dark italic">
        Crawler not found.
      </Text>
    )
  }

  return <HydratedCrawlerDisplay gameId={game.id} compact readOnly />
}
