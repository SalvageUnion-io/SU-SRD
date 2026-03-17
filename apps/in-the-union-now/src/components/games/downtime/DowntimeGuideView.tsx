import { useCallback, useMemo, useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide, SURefObjectTable } from 'salvageunion-reference'
import { ModalShell, ReferenceEntityDisplay, RollTable, Text } from 'suref-react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMechCargo } from '../../../hooks/useMechs'
import { usePilotsForCrawler } from '../../../hooks/usePilots'
import {
  useCrawlerDowntime,
  useUpdateDowntimeRecord,
  useSaveTradeRoll,
} from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { useDowntimeInteractiveConfig } from '../../../hooks/useDowntimeInteractiveConfig'
import { getErrorMessage } from '../../../lib/errors'
import { isRestoreComplete } from '../../../lib/restoreUtils'
import { isTradeComplete } from '../../../lib/tradeUtils'
import { computeMediatorTallySalvageComplete } from '../../../lib/mediatorDowntimeUtils'
import { hasObtainedEquipment } from '../../../lib/equipmentUtils'
import { hasReceivedRumour } from '../../../lib/rumourUtils'
import type { TradeResult } from '../../../lib/tradeUtils'
import type { RestoreReceipt } from '../../../lib/restoreUtils'
import type { OffloadReceipt } from '../../../lib/tallySalvageUtils'
import type { CraftReceipt } from '../../../lib/craftUtils'
import type { TrainingReceipt } from '../../../lib/trainingUtils'
import type { EquipmentReceipt } from '../../../lib/equipmentUtils'
import type { RumourReceipt } from '../../../lib/rumourUtils'
import { TallySalvageStep } from './TallySalvageStep'
import { TallySalvageMediatorView } from './TallySalvageMediatorView'
import { UpkeepStep } from './UpkeepStep'
import { RestoreStep } from './RestoreStep'
import { RestoreMediatorView } from './RestoreMediatorView'
import { TradeStep } from './TradeStep'
import { TradePlayerView } from './TradePlayerView'
import { CraftStep } from './CraftStep'
import { CraftMediatorView } from './CraftMediatorView'
import { CustomiseStep } from './CustomiseStep'
import { CustomiseMediatorView } from './CustomiseMediatorView'
import { TrainStep } from './TrainStep'
import { TrainMediatorView } from './TrainMediatorView'
import { EquipmentStep } from './EquipmentStep'
import { EquipmentMediatorView } from './EquipmentMediatorView'
import { RumourStep } from './RumourStep'
import { RumourMediatorView } from './RumourMediatorView'
import { PrepareStep } from './PrepareStep'
import { getIncompletePilots } from '../../../lib/downtimePreSessionUtils'
import type { CrawlerRow, DowntimeRecordRow, BayNpcData, PilotRow } from '../../../types/common'

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

// ---------------------------------------------------------------------------
// Player guide
// ---------------------------------------------------------------------------

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

  const bayNpcs = useMemo(
    () => (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>,
    [crawler.bay_npcs]
  )

  const restoreReceipt = useMemo(() => {
    const receipts = activeDowntime.restore_receipts as Record<string, RestoreReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.restore_receipts, pilotId])

  const restoreComplete = isRestoreComplete(restoreReceipt)

  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const tradeComplete = isTradeComplete(tradeResult)
  const preSessionStarted = activeDowntime.pre_session_started

  // Optional phase completion (steps 5-8)
  const craftReceipt = useMemo(() => {
    const receipts = activeDowntime.craft_receipts as Record<string, CraftReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.craft_receipts, pilotId])
  const craftComplete =
    (craftReceipt?.crafted_items.length ?? 0) > 0 || craftReceipt?.skipped === true

  const customiseComplete = useMemo(() => {
    const acked = activeDowntime.customise_acknowledged as Record<string, boolean> | null
    return acked?.[pilotId] === true
  }, [activeDowntime.customise_acknowledged, pilotId])

  const trainingReceipt = useMemo(() => {
    const receipts = activeDowntime.training_receipts as Record<string, TrainingReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.training_receipts, pilotId])
  const trainComplete =
    (trainingReceipt?.abilities_learned.length ?? 0) > 0 || trainingReceipt?.skipped === true

  const equipmentReceipt = useMemo(() => {
    const receipts = activeDowntime.equipment_receipts as Record<string, EquipmentReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.equipment_receipts, pilotId])
  const equipmentComplete =
    hasObtainedEquipment(equipmentReceipt) || equipmentReceipt?.skipped === true

  const rumourReceipt = useMemo(() => {
    const receipts = activeDowntime.rumour_receipts as Record<string, RumourReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.rumour_receipts, pilotId])
  const rumoursComplete = hasReceivedRumour(rumourReceipt)

  // Step render callbacks
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

  const renderCraftContent = useCallback(
    () => (
      <CraftStep
        pilotId={pilotId}
        crawlerId={crawlerId}
        crawler={crawler}
        activeDowntime={activeDowntime}
        bayNpcs={bayNpcs}
      />
    ),
    [pilotId, crawlerId, crawler, activeDowntime, bayNpcs]
  )

  const renderCustomiseContent = useCallback(
    () => (
      <CustomiseStep
        mechId={mechId}
        pilotId={pilotId}
        crawlerId={crawlerId}
        activeDowntime={activeDowntime}
        bayNpcs={bayNpcs}
      />
    ),
    [mechId, pilotId, crawlerId, activeDowntime, bayNpcs]
  )

  const renderTrainContent = useCallback(
    () => (
      <TrainStep
        pilotId={pilotId}
        crawlerId={crawlerId}
        crawlerTL={crawler.tech_level}
        activeDowntime={activeDowntime}
        bayNpcs={bayNpcs}
      />
    ),
    [pilotId, crawlerId, crawler.tech_level, activeDowntime, bayNpcs]
  )

  const renderEquipmentContent = useCallback(
    () => (
      <EquipmentStep
        pilotId={pilotId}
        crawlerId={crawlerId}
        crawlerTL={crawler.tech_level}
        activeDowntime={activeDowntime}
        bayNpcs={bayNpcs}
      />
    ),
    [pilotId, crawlerId, crawler.tech_level, activeDowntime, bayNpcs]
  )

  const renderRumoursContent = useCallback(
    () => <RumourStep pilotId={pilotId} activeDowntime={activeDowntime} bayNpcs={bayNpcs} />,
    [pilotId, activeDowntime, bayNpcs]
  )

  const renderPrepareContent = useCallback(
    () => <PrepareStep mode="player" crawler={crawler} />,
    [crawler]
  )

  const interactive = useDowntimeInteractiveConfig({
    tallySalvageComplete,
    upkeepPaid: activeDowntime.upkeep_paid,
    restoreComplete,
    tradeComplete,
    preSessionStarted,
    craftComplete,
    customiseComplete,
    trainComplete,
    equipmentComplete,
    rumoursComplete,
    renderTallySalvageContent,
    renderUpkeepContent,
    renderRestoreContent,
    renderTradeContent,
    renderCraftContent,
    renderCustomiseContent,
    renderTrainContent,
    renderEquipmentContent,
    renderRumoursContent,
    renderPrepareContent,
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

// ---------------------------------------------------------------------------
// Mediator guide
// ---------------------------------------------------------------------------

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
  const updateRecord = useUpdateDowntimeRecord()
  const saveTradeRollMutation = useSaveTradeRoll()

  // Trade roll state (lifted for RollTable callback); hydrated from DB for refresh survival
  const [tradeRollKey, setTradeRollKey] = useState<string | null>(
    activeDowntime.trade_roll_key ?? null
  )
  const [tradeRollValue, setTradeRollValue] = useState<number | null>(
    activeDowntime.trade_roll_value ?? null
  )

  // Pre-session confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [incompletePilots, setIncompletePilots] = useState<PilotRow[]>([])

  const tradeResult = activeDowntime.trade_result as TradeResult | null
  const tradeComplete = isTradeComplete(tradeResult)
  const preSessionStarted = activeDowntime.pre_session_started

  const offloadReceipts = activeDowntime.offload_receipts as Record<string, OffloadReceipt> | null
  const tallySalvageComplete = useMemo(
    () => computeMediatorTallySalvageComplete(isLoading, pilots, offloadReceipts),
    [isLoading, pilots, offloadReceipts]
  )

  // Rumour completion (mediator needs to know)
  const rumoursComplete = useMemo(() => {
    if (!pilots || pilots.length === 0) return false
    const receipts = activeDowntime.rumour_receipts as Record<string, RumourReceipt> | null
    if (!receipts) return false
    return pilots.every((p) => {
      const r = receipts[p.id] as RumourReceipt | undefined
      return r && r.rumour_text.length > 0
    })
  }, [pilots, activeDowntime.rumour_receipts])

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

  const handleConfirmMoveToPreSession = useCallback(() => {
    setConfirmModalOpen(false)
    updateRecord.mutate(
      {
        recordId: activeDowntime.id,
        crawlerId,
        input: { pre_session_started: true },
      },
      {
        onSuccess: () => toast.success('Moved to pre-session phase'),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [activeDowntime, crawlerId, updateRecord])

  const handleMoveToPreSession = useCallback(() => {
    if (pilots && pilots.length > 0) {
      const craftReceipts = activeDowntime.craft_receipts as Record<string, CraftReceipt> | null
      const trainingReceipts = activeDowntime.training_receipts as Record<
        string,
        TrainingReceipt
      > | null
      const equipmentReceipts = activeDowntime.equipment_receipts as Record<
        string,
        EquipmentReceipt
      > | null

      const incomplete = getIncompletePilots(
        pilots,
        craftReceipts,
        trainingReceipts,
        equipmentReceipts
      )

      if (incomplete.length > 0) {
        setIncompletePilots(incomplete)
        setConfirmModalOpen(true)
        return
      }
    }

    handleConfirmMoveToPreSession()
  }, [activeDowntime, pilots, handleConfirmMoveToPreSession])

  const loadingSpinner = useMemo(
    () => (
      <div className="flex items-center justify-center gap-2 py-4">
        <Loader2 className="h-4 w-4 animate-spin text-su-white/40" />
        <Text variant="default" as="span" className="text-sm text-su-white/50">
          Loading pilots...
        </Text>
      </div>
    ),
    []
  )

  const renderTallySalvageContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return (
      <TallySalvageMediatorView
        pilots={pilots ?? []}
        offloadReceipts={
          activeDowntime.offload_receipts as Record<string, OffloadReceipt> | undefined
        }
        compact={compact}
      />
    )
  }, [pilots, isLoading, compact, activeDowntime.offload_receipts, loadingSpinner])

  const renderUpkeepContent = useCallback(
    () => <UpkeepStep crawler={crawler} isMediator={true} activeDowntime={activeDowntime} />,
    [crawler, activeDowntime]
  )

  const renderRestoreContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return (
      <RestoreMediatorView
        pilots={pilots ?? []}
        restoreReceipts={
          activeDowntime.restore_receipts as Record<string, RestoreReceipt> | undefined
        }
        compact={compact}
      />
    )
  }, [pilots, isLoading, compact, activeDowntime.restore_receipts, loadingSpinner])

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
          const numericValue = key.includes('-')
            ? parseInt(key.split('-')[0]!, 10)
            : parseInt(key, 10)
          setTradeRollValue(numericValue)
          saveTradeRollMutation.mutate({
            recordId: activeDowntime.id,
            rollKey: key,
            rollValue: numericValue,
            crawlerId,
          })
        }}
      />
    ),
    [tradeResult, activeDowntime.id, crawlerId, saveTradeRollMutation]
  )

  // Mediator views for steps 5-10
  const renderCraftContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return <CraftMediatorView pilots={pilots ?? []} activeDowntime={activeDowntime} />
  }, [pilots, isLoading, activeDowntime, loadingSpinner])

  const renderCustomiseContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return <CustomiseMediatorView pilots={pilots ?? []} activeDowntime={activeDowntime} />
  }, [pilots, isLoading, activeDowntime, loadingSpinner])

  const renderTrainContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return <TrainMediatorView pilots={pilots ?? []} activeDowntime={activeDowntime} />
  }, [pilots, isLoading, activeDowntime, loadingSpinner])

  const renderEquipmentContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return <EquipmentMediatorView pilots={pilots ?? []} activeDowntime={activeDowntime} />
  }, [pilots, isLoading, activeDowntime, loadingSpinner])

  const renderRumoursContent = useCallback(() => {
    if (isLoading) return loadingSpinner
    return (
      <RumourMediatorView
        pilots={pilots ?? []}
        activeDowntime={activeDowntime}
        crawlerId={crawlerId}
      />
    )
  }, [pilots, isLoading, activeDowntime, crawlerId, loadingSpinner])

  const renderPrepareContent = useCallback(
    () => <PrepareStep mode="mediator" crawler={crawler} />,
    [crawler]
  )

  // Footer logic: show phase transition or complete button
  const renderFooter = useCallback(() => {
    // Pre-session: show Complete Downtime
    if (preSessionStarted) {
      return (
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
      )
    }

    // Optional phase: show Move to Pre-Session
    if (tradeComplete) {
      return (
        <div className="flex justify-center px-4">
          <button
            type="button"
            onClick={handleMoveToPreSession}
            disabled={updateRecord.isPending}
            className="cursor-pointer bg-su-black px-6 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
          >
            <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
              {updateRecord.isPending ? 'Moving...' : 'Move to Pre-Session'}
            </Text>
          </button>
        </div>
      )
    }

    return null
  }, [
    preSessionStarted,
    tradeComplete,
    handleCompleteDowntime,
    handleMoveToPreSession,
    crawlerDowntime.isPending,
    updateRecord.isPending,
  ])

  const interactive = useDowntimeInteractiveConfig({
    tallySalvageComplete,
    upkeepPaid: activeDowntime.upkeep_paid,
    restoreComplete: false, // Mediator always shows the restore status grid regardless of per-pilot completion
    tradeComplete,
    preSessionStarted,
    craftComplete: false, // Mediator always shows status grid
    customiseComplete: false,
    trainComplete: false,
    equipmentComplete: false,
    rumoursComplete,
    renderTallySalvageContent,
    renderUpkeepContent,
    renderRestoreContent,
    renderTradeContent,
    renderTradeSideContent,
    renderCraftContent,
    renderCustomiseContent,
    renderTrainContent,
    renderEquipmentContent,
    renderRumoursContent,
    renderPrepareContent,
    renderFooter: activeDowntime.upkeep_paid ? renderFooter : undefined,
  })

  return (
    <>
      <ReferenceEntityDisplay
        data={downtimeGuide}
        compact={compact}
        headerBgColor={DOWNTIME_HEADER_BG}
        interactive={interactive}
      />
      <ModalShell
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Move to Pre-Session?"
        headerBg="bg-su-rust"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 p-4">
          <Text variant="default">
            The following pilots haven&apos;t finished their optional steps:
          </Text>
          <ul className="flex flex-col gap-1">
            {incompletePilots.map((p) => (
              <li key={p.id}>
                <Text variant="default" className="font-semibold">
                  {p.callsign}
                </Text>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="cursor-pointer bg-su-black/10 px-4 py-2 transition-opacity hover:opacity-80"
            >
              <Text variant="pseudoheader" as="span" className="text-sm text-su-black">
                Cancel
              </Text>
            </button>
            <button
              type="button"
              onClick={handleConfirmMoveToPreSession}
              disabled={updateRecord.isPending}
              className="cursor-pointer bg-su-rust px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
            >
              <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
                {updateRecord.isPending ? 'Moving...' : 'Move Anyway'}
              </Text>
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
