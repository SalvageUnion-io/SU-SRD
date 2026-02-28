import { useState, useMemo, useCallback } from 'react'
import { StatControl, StatDisplay, Text, RollTable, ReferenceEntityDisplay } from 'suref-react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectTable, SURefEntity } from 'salvageunion-reference'
import { ArrowRight, Check, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePayUpkeep,
  useUpdateDowntimeRecord,
  useUpdateCrawler,
  useTranslateScrap,
} from '../../../hooks/useCrawlers'
import { extractScrap, contributionsToDeductions } from '../../../lib/upkeepUtils'
import { getErrorMessage } from '../../../lib/errors'
import {
  buildDeteriorationResult,
  buildPaidResult,
  computeCrawlerDeteriorationUpdate,
  getAllBays,
} from '../../../lib/deteriorationUtils'
import type { UpkeepResult } from '../../../lib/deteriorationUtils'
import { ScrapTranslationDialog } from '../ScrapTranslationDialog'
import { ModalShell } from '../../shared/ModalShell'
import type { Json } from '../../../types/database-generated.types'
import type { BayNpcData, CrawlerRow, DowntimeRecordRow } from '../../../types/common'

type UpkeepStepProps = {
  crawler: CrawlerRow
  isMediator: boolean
  activeDowntime: DowntimeRecordRow
  onComplete?: () => void
}

export function UpkeepStep({ crawler, isMediator, activeDowntime, onComplete }: UpkeepStepProps) {
  // Already paid — show summary
  if (activeDowntime.upkeep_paid) {
    const storedResult = activeDowntime.upkeep_result as UpkeepResult | null
    return <UpkeepResultSummary result={storedResult} />
  }

  // Player view: waiting
  if (!isMediator) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <Loader2 className="h-6 w-6 animate-spin text-su-white/40" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white/60">
          Waiting for Mediator...
        </Text>
      </div>
    )
  }

  // Mediator view
  return (
    <UpkeepMediatorView crawler={crawler} activeDowntime={activeDowntime} onComplete={onComplete} />
  )
}

// --- Summary component (reused in modal done phase + inline completion) ---

function UpkeepResultSummary({ result }: { result: UpkeepResult | null }) {
  if (!result) {
    // Legacy: no stored result — just show the green check
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Check className="h-8 w-8 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Upkeep Paid
        </Text>
      </div>
    )
  }

  if (result.type === 'paid') {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Check className="h-8 w-8 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Paid Dues (+{result.upgradePoolGained} to upgrade pool)
        </Text>
      </div>
    )
  }

  // Deteriorated
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <AlertTriangle className="h-8 w-8 text-su-rust" />
      <Text variant="pseudoheader" as="span" className="text-sm text-su-rust">
        Deteriorated (Roll: {result.rollKey})
      </Text>
      <div className="flex flex-col items-center gap-1 text-center">
        {result.spLost > 0 && (
          <Text as="span" className="text-xs text-su-rust">
            -{result.spLost} SP
          </Text>
        )}
        {result.bayDamagedName && (
          <Text as="span" className="text-xs text-su-rust">
            {result.bayDamagedName} damaged
            {result.selectionMethod === 'random' ? ' (random)' : ' (chosen)'}
          </Text>
        )}
        {result.spLost === 0 && !result.bayDamagedName && (
          <Text as="span" className="text-xs text-su-green">
            No effect
          </Text>
        )}
      </div>
    </div>
  )
}

// --- Multi-phase deterioration state ---

type DeteriorationPhase = 'roll' | 'select-bay' | 'applying' | 'done'

type DeteriorationState = {
  phase: DeteriorationPhase
  rollKey: string | null
  rollText: string | null
  result: UpkeepResult | null
}

// --- Mediator View ---

const TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

function UpkeepMediatorView({
  crawler,
  activeDowntime,
  onComplete,
}: {
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  onComplete?: () => void
}) {
  const payUpkeepMutation = usePayUpkeep()
  const updateDowntimeMutation = useUpdateDowntimeRecord()
  const updateCrawlerMutation = useUpdateCrawler()
  const translateScrap = useTranslateScrap()
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [deterioration, setDeterioration] = useState<DeteriorationState | null>(null)

  const deteriorationTable = useMemo(() => {
    const entity = SalvageUnionReference.RollTables.find(
      (rt) => rt.name === 'Crawler Deterioration'
    )
    return entity && 'table' in entity ? (entity.table as SURefObjectTable) : null
  }, [])

  const allBays = useMemo(() => getAllBays(), [])
  const allBayEntities = useMemo(() => SalvageUnionReference.CrawlerBays.all(), [])

  const scrap = useMemo(() => extractScrap(crawler), [crawler])
  const crawlerTL = crawler.tech_level

  // Pre-fill crawler's own TL with min(5, available)
  const availableAtCrawlerTL = scrap[`tl${crawlerTL}` as keyof typeof scrap]
  const canAfford = availableAtCrawlerTL >= 5
  const [contribution, setContribution] = useState(() => Math.min(5, availableAtCrawlerTL))

  // Single-TL contribution: 1 unit at crawlerTL = 1 unit of payment
  // If can't afford minimum, no contribution at all
  const totalPayment = canAfford ? contribution : 0
  const requirementMet = totalPayment >= 5
  const upgradePoolAfter = crawler.upgrade_pool + totalPayment

  const isPending =
    payUpkeepMutation.isPending ||
    updateDowntimeMutation.isPending ||
    updateCrawlerMutation.isPending

  // --- Mutation helpers ---

  const markUpkeepPaid = useCallback(
    (result: UpkeepResult) => {
      updateDowntimeMutation.mutate(
        {
          recordId: activeDowntime.id,
          crawlerId: crawler.id,
          input: { upkeep_paid: true, upkeep_result: result as unknown as Json },
        },
        {
          onSuccess: () => {
            setDeterioration((prev) => (prev ? { ...prev, phase: 'done', result } : prev))
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [activeDowntime.id, crawler.id, updateDowntimeMutation]
  )

  const applyDeteriorationResult = useCallback(
    (result: UpkeepResult) => {
      setDeterioration((prev) => (prev ? { ...prev, phase: 'applying', result } : prev))

      const crawlerUpdate = computeCrawlerDeteriorationUpdate(result, crawler)
      if (Object.keys(crawlerUpdate).length > 0) {
        updateCrawlerMutation.mutate(
          { crawlerId: crawler.id, input: crawlerUpdate },
          {
            onSuccess: () => markUpkeepPaid(result),
            onError: (err) => toast.error(getErrorMessage(err)),
          }
        )
      } else {
        markUpkeepPaid(result)
      }
    },
    [crawler, updateCrawlerMutation, markUpkeepPaid]
  )

  // --- Pay dues (can-afford path) ---

  const handlePayDues = useCallback(() => {
    const paidResult = buildPaidResult(totalPayment)

    if (!canAfford) {
      // Can't afford — just acknowledge (shouldn't happen from pay button, but defensive)
      updateDowntimeMutation.mutate(
        {
          recordId: activeDowntime.id,
          crawlerId: crawler.id,
          input: {
            upkeep_paid: true,
            upkeep_result: paidResult as unknown as Json,
          },
        },
        {
          onSuccess: () => {
            toast.success('Upkeep acknowledged (insufficient scrap)')
            onComplete?.()
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
      return
    }

    const deductions = contributionsToDeductions({ [crawlerTL]: contribution })

    payUpkeepMutation.mutate(
      {
        crawlerId: crawler.id,
        scrapDeductions: deductions,
        upgradePoolIncrease: totalPayment,
      },
      {
        onSuccess: () => {
          updateDowntimeMutation.mutate(
            {
              recordId: activeDowntime.id,
              crawlerId: crawler.id,
              input: {
                upkeep_paid: true,
                upkeep_result: paidResult as unknown as Json,
              },
            },
            {
              onSuccess: () => {
                toast.success(`Upkeep paid! +${totalPayment} to upgrade pool`)
                onComplete?.()
              },
              onError: (err) => toast.error(getErrorMessage(err)),
            }
          )
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [
    canAfford,
    contribution,
    crawlerTL,
    totalPayment,
    crawler.id,
    activeDowntime.id,
    payUpkeepMutation,
    updateDowntimeMutation,
    onComplete,
  ])

  // --- Deterioration flow ---

  const handleRollResult = useCallback((_text: string, key: string) => {
    setDeterioration((prev) => (prev ? { ...prev, rollKey: key, rollText: _text } : prev))
  }, [])

  const handleContinueAfterRoll = useCallback(() => {
    if (!deterioration?.rollKey || !deterioration?.rollText) return

    const bayNpcs = (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>
    const result = buildDeteriorationResult(
      deterioration.rollKey,
      deterioration.rollText,
      bayNpcs,
      allBays
    )

    if (result.selectionMethod === 'player') {
      // Need player to choose a bay
      setDeterioration((prev) => (prev ? { ...prev, phase: 'select-bay', result } : prev))
    } else {
      applyDeteriorationResult(result)
    }
  }, [deterioration, crawler.bay_npcs, allBays, applyDeteriorationResult])

  const handleBaySelected = useCallback(
    (bayId: string) => {
      if (!deterioration?.result) return

      const bayName = allBays.find((b) => b.id === bayId)?.name ?? null
      const result: UpkeepResult = {
        ...deterioration.result,
        bayDamagedId: bayId,
        bayDamagedName: bayName,
      }
      applyDeteriorationResult(result)
    },
    [deterioration, allBays, applyDeteriorationResult]
  )

  const handleSkipBayDamage = useCallback(() => {
    if (!deterioration?.result) return

    // All bays damaged — skip bay damage component
    const result: UpkeepResult = {
      ...deterioration.result,
      bayDamagedId: null,
      bayDamagedName: null,
    }
    applyDeteriorationResult(result)
  }, [deterioration, applyDeteriorationResult])

  const handleTranslate = useCallback(
    (fromTL: number, toTL: number, sourceConsumed: number, targetAmount: number) => {
      translateScrap.mutate(
        { crawlerId: crawler.id, fromTL, toTL, sourceConsumed, targetAmount },
        {
          onSuccess: () => {
            toast.success(`Converted ${sourceConsumed} TL${fromTL} → ${targetAmount} TL${toTL}`)
            setShowConvertDialog(false)
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [crawler.id, translateScrap]
  )

  const openDeteriorateModal = useCallback(() => {
    setDeterioration({ phase: 'roll', rollKey: null, rollText: null, result: null })
  }, [])

  const closeDeteriorateModal = useCallback(() => {
    // Only allow closing during roll phase or done phase
    if (deterioration?.phase === 'applying' || deterioration?.phase === 'select-bay') return
    setDeterioration(null)
  }, [deterioration?.phase])

  const bayNpcs = (crawler.bay_npcs ?? {}) as Record<string, BayNpcData>

  return (
    <>
      <div className="flex gap-4">
        {/* Left: Scrap + Convert */}
        <div className="flex flex-col gap-3">
          <div>
            <Text
              variant="pseudoheader"
              as="span"
              className="mb-2 block text-xs uppercase text-su-white/60"
            >
              Crawler Scrap
            </Text>
            <div className="flex gap-2">
              {TECH_LEVELS.map((tl) => {
                const available = scrap[`tl${tl}` as keyof typeof scrap]
                const isCrawlerTL = tl === crawlerTL
                if (isCrawlerTL) {
                  const cantAfford = !canAfford
                  if (cantAfford) {
                    return (
                      <StatDisplay
                        key={tl}
                        label={`TL${tl}`}
                        value={Math.min(5, available)}
                        outOfMax={available}
                        compact
                        bg="bg-su-rust"
                        valueColor="text-su-white"
                        borderColor="border-su-rust"
                      />
                    )
                  }
                  return (
                    <StatControl
                      key={tl}
                      label={`TL${tl}`}
                      value={contribution}
                      min={5}
                      max={available}
                      compact
                      inverse
                      canEdit={available > 0}
                      onChange={setContribution}
                    />
                  )
                }
                return (
                  <StatDisplay
                    key={tl}
                    label={`TL${tl}`}
                    value={available}
                    compact
                    disabled={available === 0}
                  />
                )
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConvertDialog(true)}
            className="cursor-pointer border border-su-black bg-transparent px-4 py-2 transition-opacity hover:opacity-70"
          >
            <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
              Convert Scrap
            </Text>
          </button>
        </div>

        {/* Right: Upgrade Pool + Pay Dues */}
        <div className="flex flex-col gap-3">
          <div>
            <Text
              variant="pseudoheader"
              as="span"
              className="mb-2 block text-xs uppercase text-su-white/60"
            >
              Upgrade Pool
            </Text>
            <div className="flex items-center">
              <StatDisplay
                label="Current"
                value={crawler.upgrade_pool}
                bottomLabel={`TL${crawlerTL}`}
                compact
              />
              <ArrowRight className="mx-auto h-4 w-4 text-su-black" />
              <StatDisplay
                label="After"
                value={upgradePoolAfter}
                bottomLabel={`TL${crawlerTL}`}
                compact
                bg={totalPayment > 0 ? 'bg-su-green/20' : 'bg-su-white'}
                borderColor={totalPayment > 0 ? 'border-su-green' : 'border-su-black'}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={canAfford ? handlePayDues : openDeteriorateModal}
            disabled={isPending || (canAfford && !requirementMet)}
            className={`cursor-pointer px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40 ${
              !canAfford ? 'bg-su-rust' : 'bg-su-black'
            }`}
          >
            <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
              {isPending
                ? 'Processing...'
                : !canAfford
                  ? 'Deteriorate (Roll)'
                  : `Pay Dues (+${totalPayment})`}
            </Text>
          </button>
        </div>
      </div>

      <ScrapTranslationDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        crawler={crawler}
        onTranslate={handleTranslate}
        isPending={translateScrap.isPending}
      />

      {/* Deterioration Modal */}
      <ModalShell
        open={deterioration !== null}
        onOpenChange={(open) => {
          if (!open) closeDeteriorateModal()
        }}
        title="Crawler Deterioration"
        headerBg="bg-su-rust"
        maxWidth="max-w-4xl"
      >
        {deterioration?.phase === 'roll' && (
          <DeteriorationRollPhase
            deteriorationTable={deteriorationTable}
            rollKey={deterioration.rollKey}
            onRollResult={handleRollResult}
            onContinue={handleContinueAfterRoll}
            onCancel={closeDeteriorateModal}
            isPending={isPending}
          />
        )}

        {deterioration?.phase === 'select-bay' && (
          <DeteriorationBaySelectPhase
            bayNpcs={bayNpcs}
            allBayEntities={allBayEntities}
            onSelect={handleBaySelected}
            onSkip={handleSkipBayDamage}
          />
        )}

        {deterioration?.phase === 'applying' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-su-rust" />
            <Text variant="pseudoheader" as="span" className="text-sm text-su-black">
              Applying deterioration...
            </Text>
          </div>
        )}

        {deterioration?.phase === 'done' && (
          <div className="flex flex-col gap-4 p-4">
            <UpkeepResultSummary result={deterioration.result} />
            <div className="flex justify-end border-t border-su-grey-dark/20 pt-3">
              <button
                type="button"
                onClick={() => {
                  setDeterioration(null)
                  onComplete?.()
                }}
                className="cursor-pointer bg-su-black px-4 py-2 transition-opacity hover:opacity-80"
              >
                <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
                  Done
                </Text>
              </button>
            </div>
          </div>
        )}
      </ModalShell>
    </>
  )
}

// --- Roll Phase ---

function DeteriorationRollPhase({
  deteriorationTable,
  rollKey,
  onRollResult,
  onContinue,
  onCancel,
  isPending,
}: {
  deteriorationTable: SURefObjectTable | null
  rollKey: string | null
  onRollResult: (text: string, key: string) => void
  onContinue: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <>
      <div className="flex gap-6 p-4">
        <div className="flex flex-1 items-center">
          <Text variant="default" as="p" className="text-sm text-su-black">
            Roll on the Union Crawler Deterioration table to find out what happens.
          </Text>
        </div>
        <div className="flex-[2]">
          {deteriorationTable && (
            <RollTable
              table={deteriorationTable}
              showCommand
              singleRoll
              tableName="Crawler Deterioration"
              compact
              onRollResult={onRollResult}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-su-grey-dark/20 px-4 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer border border-su-black bg-su-white px-4 py-2 transition-opacity hover:opacity-80"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            Cancel
          </Text>
        </button>
        <button
          type="button"
          disabled={!rollKey || isPending}
          onClick={onContinue}
          className="cursor-pointer bg-su-rust px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            {isPending ? 'Processing...' : 'Continue'}
          </Text>
        </button>
      </div>
    </>
  )
}

// --- Bay Selection Phase ---

function DeteriorationBaySelectPhase({
  bayNpcs,
  allBayEntities,
  onSelect,
  onSkip,
}: {
  bayNpcs: Record<string, BayNpcData>
  allBayEntities: Array<{ id: string; name: string }>
  onSelect: (bayId: string) => void
  onSkip: () => void
}) {
  const undamagedBays = allBayEntities.filter((b) => !bayNpcs[b.id]?.damaged)
  const allDamaged = undamagedBays.length === 0

  return (
    <div className="flex flex-col gap-4 p-4">
      <Text variant="default" as="p" className="text-sm text-su-black">
        {allDamaged
          ? 'All bays are already damaged. No further bay damage can be applied.'
          : 'Choose a bay to damage:'}
      </Text>

      {!allDamaged && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {allBayEntities.map((bay) => {
            const isDamaged = !!bayNpcs[bay.id]?.damaged
            return (
              <button
                key={bay.id}
                type="button"
                disabled={isDamaged}
                onClick={() => onSelect(bay.id)}
                className={`cursor-pointer text-left transition-opacity ${
                  isDamaged ? 'pointer-events-none opacity-40' : 'hover:opacity-80'
                }`}
              >
                <ReferenceEntityDisplay
                  data={bay as unknown as SURefEntity}
                  compact
                  label={bay.name}
                  damaged={isDamaged}
                  hide={{
                    content: true,
                    damagedEffect: true,
                    rollTable: true,
                    footer: true,
                    stats: true,
                  }}
                  damageOverlayText={isDamaged ? 'Already damaged' : undefined}
                />
              </button>
            )
          })}
        </div>
      )}

      {allDamaged && (
        <div className="flex justify-end border-t border-su-grey-dark/20 pt-3">
          <button
            type="button"
            onClick={onSkip}
            className="cursor-pointer bg-su-rust px-4 py-2 transition-opacity hover:opacity-80"
          >
            <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
              Continue
            </Text>
          </button>
        </div>
      )}
    </div>
  )
}
