import { useState, useMemo, useCallback } from 'react'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { StatDisplay, Text } from 'suref-react'
import { ArrowRight, Check, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useMechCargo, useOffloadMechCargo } from '../../../hooks/useMechs'
import { useSaveOffloadReceipt } from '../../../hooks/useCrawlers'
import {
  categorizeCargoItems,
  computeTallySummary,
  buildOffloadPayload,
  summaryToReceipt,
} from '../../../lib/tallySalvageUtils'
import type { CargoDecision, OffloadReceipt } from '../../../lib/tallySalvageUtils'
import { ReferenceEntityListingItem } from '../../shared/ReferenceEntityListingItem'
import { getErrorMessage } from '../../../lib/errors'
import type { DowntimeRecordRow } from '../../../types/common'

type TallySalvageStepProps = {
  mechId: string
  crawlerId: string
  pilotId: string
  activeDowntime: DowntimeRecordRow
  compact?: boolean
  onComplete?: () => void
}

export function TallySalvageStep({
  mechId,
  crawlerId,
  pilotId,
  activeDowntime,
  compact = true,
  onComplete,
}: TallySalvageStepProps) {
  const { data: cargo, isLoading } = useMechCargo(mechId)
  const offloadMutation = useOffloadMechCargo()
  const saveReceiptMutation = useSaveOffloadReceipt()

  // Check for existing server-side receipt for this pilot
  const existingReceipt = useMemo(() => {
    const receipts = activeDowntime.offload_receipts as Record<string, OffloadReceipt> | null
    return receipts?.[pilotId] ?? null
  }, [activeDowntime.offload_receipts, pilotId])

  const [decisions, setDecisions] = useState<Record<string, CargoDecision>>({})
  const [offloadedSummary, setOffloadedSummary] = useState<OffloadReceipt | null>(existingReceipt)

  const { rawScrap, entityItems } = useMemo(() => categorizeCargoItems(cargo ?? []), [cargo])

  const summary = useMemo(
    () => computeTallySummary(rawScrap, entityItems, decisions),
    [rawScrap, entityItems, decisions]
  )

  const handleToggleDecision = useCallback((cargoId: string) => {
    setDecisions((prev) => ({
      ...prev,
      [cargoId]: prev[cargoId] === 'storage' ? 'scrap' : 'storage',
    }))
  }, [])

  const handleOffload = useCallback(() => {
    const { storageCargoIds, scrapAdditions } = buildOffloadPayload(
      rawScrap,
      entityItems,
      decisions
    )
    // Snapshot the summary before offload clears cargo
    const snapshotSummary = computeTallySummary(rawScrap, entityItems, decisions)
    const receipt = summaryToReceipt(snapshotSummary)
    offloadMutation.mutate(
      { mechId, crawlerId, storageCargoIds, scrapAdditions },
      {
        onSuccess: () => {
          setOffloadedSummary(receipt)
          // Persist receipt server-side (fire-and-forget)
          saveReceiptMutation.mutate({
            recordId: activeDowntime.id,
            pilotId,
            receipt,
            crawlerId,
          })
          toast.success('Cargo offloaded to crawler!')
          onComplete?.()
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [
    rawScrap,
    entityItems,
    decisions,
    mechId,
    crawlerId,
    offloadMutation,
    onComplete,
    activeDowntime.id,
    pilotId,
    saveReceiptMutation,
  ])

  // Cargo empty — either never had any, or already offloaded
  if (!isLoading && (!cargo || cargo.length === 0)) {
    // Had cargo and offloaded it — show the offload summary
    if (offloadedSummary) {
      return <OffloadedSummary receipt={offloadedSummary} compact={compact} />
    }
    // Never had cargo
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white/50">
          No Cargo
        </Text>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="py-4 text-center">
        <Text variant="default" as="p" className="text-su-white/50">
          Loading cargo...
        </Text>
      </div>
    )
  }

  const hasItems = rawScrap.length > 0 || entityItems.length > 0

  return (
    <div className="flex flex-col gap-3">
      {/* Raw Scrap */}
      {rawScrap.length > 0 && (
        <div>
          <Text
            variant="pseudoheader"
            as="span"
            className="mb-1 block text-xs uppercase text-su-white/60"
          >
            Raw Scrap
          </Text>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {rawScrap.map(({ techLevel, amount }) => (
              <StatDisplay
                key={`raw-${techLevel}`}
                label={`TL${techLevel}`}
                value={amount}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Entity Items */}
      {entityItems.length > 0 && (
        <div>
          <Text
            variant="pseudoheader"
            as="span"
            className="mb-1 block text-xs uppercase text-su-white/60"
          >
            Entity Items
          </Text>
          <div className="mt-1 flex flex-col gap-2">
            {entityItems.map((item) => {
              const decision = decisions[item.cargoId] ?? 'scrap'
              const entity = SalvageUnionReference.get(
                item.schemaName as EntitySchemaName,
                item.schemaRefId
              ) as SURefEntity | undefined

              return (
                <div key={item.cargoId} className="flex items-center gap-2">
                  {/* Entity listing */}
                  <div className="min-w-0 flex-1">
                    {entity ? (
                      <ReferenceEntityListingItem entity={entity} />
                    ) : (
                      <Text variant="default" as="span" className="text-sm">
                        {item.name}
                      </Text>
                    )}
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 shrink-0 text-su-white/40" />

                  {/* Target indicator */}
                  {decision === 'scrap' ? (
                    <StatDisplay label={`TL${item.techLevel}`} value={item.salvageValue} compact />
                  ) : (
                    <div className="flex items-center gap-1 rounded border border-su-pink/50 bg-su-pink/10 px-2 py-1">
                      <Package className="h-3.5 w-3.5 text-su-pink" />
                      <Text variant="pseudoheader" as="span" className="text-[10px] text-su-pink">
                        Storage
                      </Text>
                    </div>
                  )}

                  {/* Toggle button */}
                  <button
                    type="button"
                    onClick={() => handleToggleDecision(item.cargoId)}
                    className={`shrink-0 cursor-pointer rounded border px-2 py-1 font-mono text-[10px] font-bold uppercase transition-colors ${
                      decision === 'scrap'
                        ? 'border-su-white/20 text-su-white/50 hover:border-su-pink/50 hover:text-su-pink'
                        : 'border-su-white/20 text-su-white/50 hover:border-su-green/50 hover:text-su-green'
                    }`}
                  >
                    {decision === 'scrap' ? 'To Storage' : 'To Scrap'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Totals */}
      {hasItems && (
        <div>
          <Text
            variant="pseudoheader"
            as="span"
            className="mb-1 block text-xs uppercase text-su-white/60"
          >
            Totals
          </Text>
          <div className="mt-1 flex flex-wrap items-start gap-3">
            {/* Scrap totals */}
            <div>
              <Text
                variant="pseudoheader"
                as="span"
                className="mb-1 block text-[10px] text-su-white/60"
              >
                Scrap
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.scrapByTL)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tl, amount]) => (
                    <StatDisplay key={`total-${tl}`} label={`TL${tl}`} value={amount} compact />
                  ))}
                {Object.keys(summary.scrapByTL).length === 0 && (
                  <Text variant="default" as="span" className="text-xs text-su-white/30">
                    None
                  </Text>
                )}
              </div>
            </div>

            {/* Storage totals */}
            {summary.storageItems.length > 0 && (
              <div>
                <Text
                  variant="pseudoheader"
                  as="span"
                  className="mb-1 block text-[10px] text-su-white/60"
                >
                  Storage
                </Text>
                <div className="flex flex-wrap gap-1.5">
                  <StatDisplay
                    label="Items"
                    value={summary.storageItems.length}
                    compact
                    bg="bg-su-pink/20"
                    borderColor="border-su-pink/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offload button */}
      {hasItems && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleOffload}
            disabled={offloadMutation.isPending}
            className="cursor-pointer bg-su-black px-4 py-2 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
          >
            <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
              {offloadMutation.isPending ? 'Offloading...' : 'Offload'}
            </Text>
          </button>
        </div>
      )}
    </div>
  )
}

function OffloadedSummary({
  receipt,
  compact = true,
}: {
  receipt: OffloadReceipt
  compact?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Cargo Offloaded
        </Text>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div>
          <Text
            variant="pseudoheader"
            as="span"
            className="mb-1 block text-[10px] text-su-white/60"
          >
            Scrap
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(receipt.scrapByTL)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([tl, amount]) => (
                <StatDisplay
                  key={`total-${tl}`}
                  label={`TL${tl}`}
                  value={amount}
                  compact={compact}
                />
              ))}
            {Object.keys(receipt.scrapByTL).length === 0 && (
              <Text variant="default" as="span" className="text-xs text-su-white/30">
                None
              </Text>
            )}
          </div>
        </div>

        {receipt.storageCount > 0 && (
          <div>
            <Text
              variant="pseudoheader"
              as="span"
              className="mb-1 block text-[10px] text-su-white/60"
            >
              Storage
            </Text>
            <div className="flex flex-wrap gap-1.5">
              <StatDisplay
                label="Items"
                value={receipt.storageCount}
                compact={compact}
                bg="bg-su-pink/20"
                borderColor="border-su-pink/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
