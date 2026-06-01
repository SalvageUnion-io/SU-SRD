import type { ReferenceEntityControl } from 'suref-react'
import { useCrawlerSheet } from '../../hooks/useCrawlerSheet'
import { PageSkeleton } from '../shared/PageSkeleton'
import { NotFoundState } from '../shared/NotFoundState'
import { Skeleton } from '../ui/skeleton'
import { PlayerCrawlerDisplay } from './PlayerCrawlerDisplay'

type HydratedCrawlerDisplayProps = {
  gameId: string
  listing?: boolean
  compact?: boolean
  readOnly?: boolean
  controls?: ReferenceEntityControl[]
}

export function HydratedCrawlerDisplay({
  gameId,
  listing = false,
  compact = false,
  readOnly = false,
  controls,
}: HydratedCrawlerDisplayProps) {
  const sheet = useCrawlerSheet(gameId)

  if (sheet.isLoading) {
    return listing && compact ? <Skeleton className="h-[40px] rounded-md" /> : <PageSkeleton />
  }

  if (!sheet.game) {
    return <NotFoundState message="Game not found." />
  }

  if (!listing && (!sheet.game.crawler_id || !sheet.crawler)) {
    return <NotFoundState message="Crawler not found." />
  }

  return (
    <PlayerCrawlerDisplay
      game={sheet.game}
      crawler={sheet.crawler}
      listing={listing}
      compact={compact}
      controls={controls}
      readOnly={readOnly}
      crawlerType={sheet.crawlerType}
      tlStats={sheet.tlStats}
      populationStr={sheet.populationStr}
      weaponRefs={sheet.weaponRefs}
      userId={sheet.userId}
      activeDowntime={sheet.activeDowntime}
      editConfig={listing ? undefined : sheet.editConfig}
    />
  )
}
