import { useCallback, useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide, SURefObjectTable } from 'salvageunion-reference'
import { ReferenceEntityDisplay, RollTable, Text } from 'suref-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMechCargo } from '../../../hooks/useMechs'
import { usePilotsForCrawler } from '../../../hooks/usePilots'
import { useCrawlerDowntime } from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { useDowntimeInteractiveConfig } from '../../../hooks/useDowntimeInteractiveConfig'
import { getErrorMessage } from '../../../lib/errors'
import { isRestoreComplete } from '../../../lib/restoreUtils'
import { isTradeComplete } from '../../../lib/tradeUtils'
import type { TradeResult } from '../../../lib/tradeUtils'
import type { RestoreReceipt } from '../../../lib/restoreUtils'
import type { OffloadReceipt } from '../../../lib/tallySalvageUtils'
import { TallySalvageStep } from './TallySalvageStep'
import { TallySalvageMediatorView } from './TallySalvageMediatorView'
import { UpkeepStep } from './UpkeepStep'
import { RestoreStep } from './RestoreStep'
import { RestoreMediatorView } from './RestoreMediatorView'
import { TradeStep } from './TradeStep'
import { TradePlayerView } from './TradePlayerView'
import type { CrawlerRow, DowntimeRecordRow } from '../../../types/common'

const tradingBayTable = SalvageUnionReference.RollTables.find(
  (rt) => rt.id === '12a6fcf2-2eda-492e-b9f5-f86a340c9fb3'
)!

const DOWNTIME_HEADER_BG = 'color-mix(in srgb, rgb(206, 88, 152) 35%, white)'

type DowntimeGuideViewProps = {
  mode: 'player' | 'mediator'
  mechId?: string
  pilotId?: string
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}

export function DowntimeGuideView({
  mode,
  mechId,
  pilotId,
  crawlerId,
  crawler,
  activeDowntime,
  compact = true,
}: DowntimeGuideViewProps) {
  if (mode === 'player') {
    return (
      <PlayerDowntimeGuide
        mechId={mechId!}
        pilotId={pilotId!}
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
  pilotId,
  crawlerId,
  crawler,
  activeDowntime,
  compact,
}: {
  mechId: string
  pilotId: string
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}) {
  const downtimeGuide = useMemo(
    () =>
      SalvageUnionReference.Guides.find(
        (g) => g.id === '5b57c66c-ad03-4184-b081-366c98c44fbe'
      )! as SURefGuide,
    []
  )

  const { data: cargo, isLoading } = useMechCargo(mechId)
  const tallySalvageComplete = !isLoading && (!cargo || cargo.length === 0)

  const restoreReceipt = useMemo(() => {
    const receipts = activeDowntime.restore_receipts as Record<string, RestoreReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.restore_receipts, pilotId])

  const restoreComplete = isRestoreComplete(restoreReceipt)

  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const tradeComplete = isTradeComplete(tradeResult)

  const renderTallySalvageContent = useCallback(
    () => (
      <TallySalvageStep
        mechId={mechId}
        crawlerId={crawlerId}
        pilotId={pilotId}
        activeDowntime={activeDowntime}
        compact={compact}
      />
    ),
    [mechId, crawlerId, pilotId, activeDowntime, compact]
  )

  const renderUpkeepContent = useCallback(
    () => <UpkeepStep crawler={crawler} isMediator={false} activeDowntime={activeDowntime} />,
    [crawler, activeDowntime]
  )

  const renderRestoreContent = useCallback(
    () => (
      <RestoreStep
        mechId={mechId}
        pilotId={pilotId}
        crawlerId={crawlerId}
        crawlerTL={crawler.tech_level}
        activeDowntime={activeDowntime}
        compact={compact}
      />
    ),
    [mechId, pilotId, crawlerId, crawler.tech_level, activeDowntime, compact]
  )

  const renderTradeContent = useCallback(
    () => <TradePlayerView activeDowntime={activeDowntime} />,
    [activeDowntime]
  )

  const interactive = useDowntimeInteractiveConfig({
    tallySalvageComplete,
    upkeepPaid: activeDowntime.upkeep_paid,
    restoreComplete,
    tradeComplete,
    renderTallySalvageContent,
    renderUpkeepContent,
    renderRestoreContent,
    renderTradeContent,
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
  const downtimeGuide = useMemo(
    () =>
      SalvageUnionReference.Guides.find(
        (g) => g.id === '5b57c66c-ad03-4184-b081-366c98c44fbe'
      )! as SURefGuide,
    []
  )

  const { data: pilots, isLoading } = usePilotsForCrawler(crawlerId)
  const user = useCurrentUser()
  const crawlerDowntime = useCrawlerDowntime()

  // Trade roll state (lifted for RollTable callback)
  const [tradeRollKey, setTradeRollKey] = useState<string | null>(null)
  const [tradeRollValue, setTradeRollValue] = useState<number | null>(null)

  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const tradeComplete = isTradeComplete(tradeResult)

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
    return (
      <TallySalvageMediatorView
        pilots={pilots ?? []}
        offloadReceipts={
          activeDowntime.offload_receipts as Record<string, OffloadReceipt> | undefined
        }
        compact={compact}
      />
    )
  }, [pilots, isLoading, compact, activeDowntime.offload_receipts])

  const renderUpkeepContent = useCallback(
    () => <UpkeepStep crawler={crawler} isMediator={true} activeDowntime={activeDowntime} />,
    [crawler, activeDowntime]
  )

  const renderRestoreContent = useCallback(() => {
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
    return (
      <RestoreMediatorView
        pilots={pilots ?? []}
        restoreReceipts={
          activeDowntime.restore_receipts as Record<string, RestoreReceipt> | undefined
        }
        compact={compact}
      />
    )
  }, [pilots, isLoading, compact, activeDowntime.restore_receipts])

  const renderTradeContent = useCallback(
    () => (
      <TradeStep
        crawlerId={crawlerId}
        crawlerTL={crawler.tech_level}
        activeDowntime={activeDowntime}
        rollKey={tradeRollKey}
        rollValue={tradeRollValue}
      />
    ),
    [crawlerId, crawler.tech_level, activeDowntime, tradeRollKey, tradeRollValue]
  )

  const renderTradeSideContent = useCallback(
    () => (
      <RollTable
        table={tradingBayTable.table as SURefObjectTable}
        tableName="Trading Bay"
        compact
        singleRoll
        disabled={!!tradeResult}
        onRollResult={(_text, key) => {
          setTradeRollKey(key)
          // Parse numeric value from the key for storage
          const numericValue = key.includes('-')
            ? parseInt(key.split('-')[0]!, 10)
            : parseInt(key, 10)
          setTradeRollValue(numericValue)
        }}
      />
    ),
    [tradeResult]
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
    restoreComplete: false,
    tradeComplete,
    renderTallySalvageContent,
    renderUpkeepContent,
    renderRestoreContent,
    renderTradeContent,
    renderTradeSideContent,
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
