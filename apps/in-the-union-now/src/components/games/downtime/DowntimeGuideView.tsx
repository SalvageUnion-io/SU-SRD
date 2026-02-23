import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text } from 'suref-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMechCargo } from '../../../hooks/useMechs'
import { usePilotsForCrawler } from '../../../hooks/usePilots'
import { useCrawlerDowntime } from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { useDowntimeInteractiveConfig } from '../../../hooks/useDowntimeInteractiveConfig'
import { getErrorMessage } from '../../../lib/errors'
import { TallySalvageStep } from './TallySalvageStep'
import { TallySalvageMediatorView } from './TallySalvageMediatorView'
import { UpkeepStep } from './UpkeepStep'
import type { CrawlerRow, DowntimeRecordRow } from '../../../types/common'

const downtimeGuide = SalvageUnionReference.Guides.find(
  (g) => g.id === '5b57c66c-ad03-4184-b081-366c98c44fbe'
)! as SURefGuide

const DOWNTIME_HEADER_BG = 'color-mix(in srgb, rgb(206, 88, 152) 35%, white)'

type DowntimeGuideViewProps = {
  mode: 'player' | 'mediator'
  mechId?: string
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}

export function DowntimeGuideView({
  mode,
  mechId,
  crawlerId,
  crawler,
  activeDowntime,
  compact = true,
}: DowntimeGuideViewProps) {
  if (mode === 'player') {
    return (
      <PlayerDowntimeGuide
        mechId={mechId!}
        crawlerId={crawlerId}
        crawler={crawler}
        activeDowntime={activeDowntime}
        compact={compact}
      />
    )
  }

  return (
    <MediatorDowntimeGuide
      crawlerId={crawlerId}
      crawler={crawler}
      activeDowntime={activeDowntime}
      compact={compact}
    />
  )
}

function PlayerDowntimeGuide({
  mechId,
  crawlerId,
  crawler,
  activeDowntime,
  compact,
}: {
  mechId: string
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}) {
  const { data: cargo, isLoading } = useMechCargo(mechId)
  const tallySalvageComplete = !isLoading && (!cargo || cargo.length === 0)

  const renderTallySalvageContent = useCallback(
    () => <TallySalvageStep mechId={mechId} crawlerId={crawlerId} compact={compact} />,
    [mechId, crawlerId, compact]
  )

  const renderUpkeepContent = useCallback(
    () => <UpkeepStep crawler={crawler} isMediator={false} activeDowntime={activeDowntime} />,
    [crawler, activeDowntime]
  )

  const interactive = useDowntimeInteractiveConfig({
    tallySalvageComplete,
    upkeepPaid: activeDowntime.upkeep_paid,
    renderTallySalvageContent,
    renderUpkeepContent,
  })

  return (
    <ReferenceEntityDisplay
      data={downtimeGuide}
      compact={compact}
      headerBgColor={DOWNTIME_HEADER_BG}
      interactive={interactive}
    />
  )
}

function MediatorDowntimeGuide({
  crawlerId,
  crawler,
  activeDowntime,
  compact,
}: {
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}) {
  const { data: pilots, isLoading } = usePilotsForCrawler(crawlerId)
  const user = useCurrentUser()
  const crawlerDowntime = useCrawlerDowntime()

  const handleCompleteDowntime = useCallback(() => {
    if (!user) return
    crawlerDowntime.mutate(
      { crawlerId, entering: false, userId: user.id },
      {
        onSuccess: () => toast.success('Downtime completed'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, crawlerId, crawlerDowntime])

  const renderTallySalvageContent = useCallback(() => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
          <Text variant="default" as="span" className="text-sm text-su-white/50">
            Loading pilots...
          </Text>
        </div>
      )
    }
    return <TallySalvageMediatorView pilots={pilots ?? []} compact={compact} />
  }, [pilots, isLoading, compact])

  const renderUpkeepContent = useCallback(
    () => <UpkeepStep crawler={crawler} isMediator={true} activeDowntime={activeDowntime} />,
    [crawler, activeDowntime]
  )

  const renderFooter = useCallback(
    () => (
      <div className="flex justify-center px-4">
        <button
          type="button"
          onClick={handleCompleteDowntime}
          disabled={crawlerDowntime.isPending}
          className="cursor-pointer bg-su-black px-6 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            {crawlerDowntime.isPending ? 'Completing...' : 'Complete Downtime'}
          </Text>
        </button>
      </div>
    ),
    [handleCompleteDowntime, crawlerDowntime.isPending]
  )

  // Mediator: tally salvage stays "current" until upkeep_paid (mediator always sees the pilot status grid)
  const interactive = useDowntimeInteractiveConfig({
    tallySalvageComplete: false,
    upkeepPaid: activeDowntime.upkeep_paid,
    renderTallySalvageContent,
    renderUpkeepContent,
    renderFooter: activeDowntime.upkeep_paid ? renderFooter : undefined,
  })

  return (
    <ReferenceEntityDisplay
      data={downtimeGuide}
      compact={compact}
      headerBgColor={DOWNTIME_HEADER_BG}
      interactive={interactive}
    />
  )
}
