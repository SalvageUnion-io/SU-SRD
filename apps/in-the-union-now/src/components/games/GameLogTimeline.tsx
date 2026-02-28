import { useMemo } from 'react'
import { Text } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useGameChangeLog } from '../../hooks/useGameChangeLog'
import { usePilotsForCrawler } from '../../hooks/usePilots'
import { useMechMap } from '../../hooks/useMechMap'
import { buildNameRegistry, highlightEntityNames } from '../../lib/logHighlighting'
import { findChassisById } from '../../lib/entityHelpers'
import { RelativeTimestamp } from './RelativeTimestamp'
import { Skeleton } from '../ui/skeleton'
import type { CrawlerRow } from '../../types/common'

type GameLogTimelineProps = {
  gameId: string
  crawler: CrawlerRow
  compact?: boolean
}

export function GameLogTimeline({ gameId, crawler, compact }: GameLogTimelineProps) {
  const { entries, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGameChangeLog(gameId)

  const { data: pilots } = usePilotsForCrawler(crawler.id)

  const mechIds = useMemo(
    () => (pilots ?? []).map((p) => p.mech_id).filter(Boolean) as string[],
    [pilots]
  )
  const { mechMap } = useMechMap(mechIds)

  const nameRegistry = useMemo(() => {
    const crawlerType = SalvageUnionReference.get('crawlers', crawler.crawler_ref)
    const crawlerName = crawler.name || crawlerType?.name || undefined

    const pilotCallsigns = (pilots ?? []).map((p) => p.callsign).filter(Boolean)

    const mechPatternNames: string[] = []
    for (const mech of mechMap.values()) {
      if (mech.pattern_name) mechPatternNames.push(mech.pattern_name)
      const chassis = findChassisById(mech.chassis_ref)
      if (chassis?.name) mechPatternNames.push(chassis.name)
    }

    return buildNameRegistry({ crawlerName, pilotCallsigns, mechPatternNames })
  }, [crawler, pilots, mechMap])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-5 w-1/2 rounded" />
        <Skeleton className="h-5 w-2/3 rounded" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <Text variant="default" as="p" className="py-6 text-center text-su-white/50">
        No activity recorded yet.
      </Text>
    )
  }

  return (
    <div className="flex max-h-[400px] flex-col gap-0 overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex items-baseline justify-between gap-3 border-b border-su-grey-light/30 ${compact ? 'py-1.5' : 'py-2'} last:border-b-0`}
        >
          <span
            className={`min-w-0 font-mono ${compact ? 'text-xs' : 'text-sm'} leading-snug text-su-white/90`}
          >
            {highlightEntityNames(entry.description ?? '', nameRegistry)}
          </span>
          <RelativeTimestamp
            dateStr={entry.created_at}
            className={`shrink-0 font-mono ${compact ? 'text-[10px]' : 'text-xs'} text-su-white/40`}
          />
        </div>
      ))}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-2 cursor-pointer self-center rounded border border-su-grey-light/40 px-3 py-1 font-mono text-xs text-su-white/60 transition-colors hover:bg-su-grey-light/20 hover:text-su-white disabled:cursor-default disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
