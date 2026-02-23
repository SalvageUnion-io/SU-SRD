import { useState, useMemo, useCallback } from 'react'
import { StatControl, StatDisplay, Text } from 'suref-react'
import { ArrowRight, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePayUpkeep, useUpdateDowntimeRecord } from '../../../hooks/useCrawlers'
import {
  extractScrap,
  computeTotalPayment,
  contributionsToDeductions,
  canAffordMinimumUpkeep,
} from '../../../lib/upkeepUtils'
import { getErrorMessage } from '../../../lib/errors'
import type { CrawlerRow, DowntimeRecordRow } from '../../../types/common'

type UpkeepStepProps = {
  crawler: CrawlerRow
  isMediator: boolean
  activeDowntime: DowntimeRecordRow
  onComplete?: () => void
}

export function UpkeepStep({ crawler, isMediator, activeDowntime, onComplete }: UpkeepStepProps) {
  // Already paid
  if (activeDowntime.upkeep_paid) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Check className="h-8 w-8 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Upkeep Paid
        </Text>
      </div>
    )
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

  const scrap = useMemo(() => extractScrap(crawler), [crawler])
  const crawlerTL = crawler.tech_level

  const canAfford = useMemo(() => canAffordMinimumUpkeep(scrap, crawlerTL), [scrap, crawlerTL])

  // Pre-fill crawler's own TL with min(5, available)
  const availableAtCrawlerTL = scrap[`tl${crawlerTL}` as keyof typeof scrap]
  const [contributions, setContributions] = useState<Record<number, number>>(() => ({
    [crawlerTL]: Math.min(5, availableAtCrawlerTL),
  }))

  const totalPayment = useMemo(
    () => computeTotalPayment(contributions, crawlerTL),
    [contributions, crawlerTL]
  )
  const requirementMet = totalPayment >= 5
  const upgradePoolAfter = crawler.upgrade_pool + totalPayment

  const isPending = payUpkeepMutation.isPending || updateDowntimeMutation.isPending

  const updateContribution = useCallback((tl: number, value: number) => {
    setContributions((prev) => ({ ...prev, [tl]: value }))
  }, [])

  const handlePayDues = useCallback(() => {
    if (!canAfford) {
      // Can't afford — just acknowledge
      updateDowntimeMutation.mutate(
        { recordId: activeDowntime.id, crawlerId: crawler.id, input: { upkeep_paid: true } },
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

    const deductions = contributionsToDeductions(contributions)

    payUpkeepMutation.mutate(
      {
        crawlerId: crawler.id,
        scrapDeductions: deductions,
        upgradePoolIncrease: totalPayment,
      },
      {
        onSuccess: () => {
          updateDowntimeMutation.mutate(
            { recordId: activeDowntime.id, crawlerId: crawler.id, input: { upkeep_paid: true } },
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
    contributions,
    totalPayment,
    crawler.id,
    activeDowntime.id,
    payUpkeepMutation,
    updateDowntimeMutation,
    onComplete,
  ])

  return (
    <div className="flex flex-col gap-3">
      {/* Panel 1: Allocate Scrap */}
      <div className="rounded-lg bg-su-white/5 p-3">
        <Text
          variant="pseudoheader"
          as="span"
          className="mb-2 block text-xs uppercase text-su-white/60"
        >
          Allocate Scrap
        </Text>
        <div className="grid grid-cols-3 gap-2">
          {TECH_LEVELS.map((tl) => {
            const available = scrap[`tl${tl}` as keyof typeof scrap]
            const isCrawlerTL = tl === crawlerTL
            return (
              <StatControl
                key={tl}
                label={`TL${tl}`}
                value={contributions[tl] ?? 0}
                max={available}
                compact
                inverse={isCrawlerTL}
                canEdit={available > 0}
                onChange={(v) => updateContribution(tl, v)}
              />
            )
          })}
        </div>
      </div>

      {/* Panel 2: Requirement */}
      <div className="rounded-lg bg-su-white/5 p-3">
        <Text
          variant="pseudoheader"
          as="span"
          className="mb-2 block text-xs uppercase text-su-white/60"
        >
          Requirement
        </Text>
        <div className="flex items-center gap-2">
          <StatDisplay
            label={`TL${crawlerTL} Eq.`}
            value={totalPayment}
            compact
            bg={requirementMet ? 'bg-su-green/20' : 'bg-su-black'}
            borderColor={requirementMet ? 'border-su-green' : 'border-su-orange'}
          />
          <Text variant="pseudoheader" as="span" className="text-xs text-su-white/60">
            / 5 min
          </Text>
        </div>
        {!requirementMet && canAfford && (
          <Text variant="default" as="p" className="mt-1.5 text-xs text-su-white/50">
            Allocate at least 5 TL{crawlerTL}-equivalent scrap to pay dues.
          </Text>
        )}
      </div>

      {/* Panel 3: Upgrade Pool */}
      <div className="rounded-lg bg-su-white/5 p-3">
        <Text
          variant="pseudoheader"
          as="span"
          className="mb-2 block text-xs uppercase text-su-white/60"
        >
          Upgrade Pool
        </Text>
        <div className="flex items-center gap-2">
          <StatDisplay label="Current" value={crawler.upgrade_pool} compact />
          <ArrowRight className="h-4 w-4 text-su-white/40" />
          <StatDisplay
            label="After"
            value={upgradePoolAfter}
            compact
            bg={totalPayment > 0 ? 'bg-su-green/20' : 'bg-su-white'}
            borderColor={totalPayment > 0 ? 'border-su-green' : 'border-su-black'}
          />
        </div>
      </div>

      {/* Warning: can't afford */}
      {!canAfford && (
        <div className="flex items-start gap-2 rounded border border-su-orange/50 bg-su-orange/10 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-su-orange" />
          <Text variant="default" as="p" className="text-xs text-su-orange">
            Not enough scrap! A roll on the critical damage table is required.
          </Text>
        </div>
      )}

      {/* Pay button */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handlePayDues}
          disabled={isPending || (canAfford && !requirementMet)}
          className="cursor-pointer bg-su-black px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            {isPending
              ? 'Processing...'
              : !canAfford
                ? 'Acknowledge'
                : `Pay Dues (+${totalPayment})`}
          </Text>
        </button>
      </div>
    </div>
  )
}
