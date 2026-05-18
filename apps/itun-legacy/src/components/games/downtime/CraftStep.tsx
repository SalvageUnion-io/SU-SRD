import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { Text } from 'suref-react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  useSaveCraftReceipt,
  useUpdateCrawler,
  useCreateCrawlerEntityRef,
} from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { isCraftingBayDamaged } from '../../../lib/bayDamageUtils'
import { getAvailableScrapAfterCrafts, computeCraftDeduction } from '../../../lib/craftUtils'
import type { CraftReceipt, CraftedItem } from '../../../lib/craftUtils'
import { getErrorMessage } from '../../../lib/errors'
import { getEntityId } from '../../../lib/entitySelectionUtils'
import { CraftSelectionModal } from './CraftSelectionModal'
import type { DowntimeRecordRow, CrawlerRow } from '../../../types/common'
import type { BayNpcData } from '../../../types/common'

type CraftStepProps = {
  pilotId: string
  crawlerId: string
  crawler: CrawlerRow
  activeDowntime: DowntimeRecordRow
  bayNpcs: Record<string, BayNpcData>
}

export function CraftStep({
  pilotId,
  crawlerId,
  crawler,
  activeDowntime,
  bayNpcs,
}: CraftStepProps) {
  const user = useCurrentUser()
  const saveReceipt = useSaveCraftReceipt()
  const updateCrawler = useUpdateCrawler()
  const createEntityRef = useCreateCrawlerEntityRef()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const bayDamaged = isCraftingBayDamaged(bayNpcs)

  const receipt = useMemo(() => {
    const receipts = activeDowntime.craft_receipts as Record<string, CraftReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.craft_receipts, pilotId])

  const availableScrap = useMemo(
    () => getAvailableScrapAfterCrafts(crawler, receipt),
    [crawler, receipt]
  )

  const handleCraft = useCallback(
    async (entity: SURefEntity, schemaName: 'chassis' | 'systems' | 'modules') => {
      if (!user) return
      setSaving(true)
      try {
        const entityId = getEntityId(entity)
        const entityName = 'name' in entity ? (entity.name as string) : 'Unknown'
        const deduction = computeCraftDeduction(entity)

        // Deduct scrap from crawler
        if (deduction) {
          const current = crawler[deduction.field as keyof CrawlerRow] as number
          await new Promise<void>((resolve, reject) =>
            updateCrawler.mutate(
              {
                crawlerId,
                input: { [deduction.field]: current - deduction.amount },
              },
              { onSuccess: () => resolve(), onError: reject }
            )
          )
        }

        // Create entity_ref on crawler (storage)
        await new Promise<void>((resolve, reject) =>
          createEntityRef.mutate(
            {
              input: {
                parent_id: crawlerId,
                parent_type: 'crawler',
                schema_name: schemaName,
                schema_ref_id: entityId,
                user_id: user.id,
              },
              crawlerId,
            },
            { onSuccess: () => resolve(), onError: reject }
          )
        )

        // Update receipt
        const craftedItem: CraftedItem = {
          schema_name: schemaName,
          ref_id: entityId,
          name: entityName,
          scrap_cost: deduction?.amount ?? 0,
          scrap_tl: deduction?.tl ?? 1,
        }
        const newReceipt: CraftReceipt = {
          crafted_items: [...(receipt?.crafted_items ?? []), craftedItem],
        }
        saveReceipt.mutate({
          recordId: activeDowntime.id,
          pilotId,
          receipt: newReceipt,
          crawlerId,
        })

        toast.success(`Crafted ${entityName}`)
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    },
    [
      user,
      crawler,
      crawlerId,
      pilotId,
      activeDowntime.id,
      receipt,
      updateCrawler,
      createEntityRef,
      saveReceipt,
    ]
  )

  const isSkipped = receipt?.skipped === true

  const handleSkip = useCallback(() => {
    saveReceipt.mutate({
      recordId: activeDowntime.id,
      pilotId,
      receipt: { crafted_items: [], skipped: true },
      crawlerId,
    })
  }, [activeDowntime.id, pilotId, crawlerId, saveReceipt])

  if (bayDamaged) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="h-4 w-4 text-su-rust" />
        <Text variant="default" as="span" className="text-sm text-su-rust">
          Crafting Bay is damaged — crafting unavailable.
        </Text>
      </div>
    )
  }

  const craftedCount = receipt?.crafted_items.length ?? 0

  return (
    <div className="flex flex-col gap-2">
      {craftedCount > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-su-green" />
            <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
              Crafted {craftedCount} item{craftedCount !== 1 ? 's' : ''}
            </Text>
          </div>
          {receipt!.crafted_items.map((item, i) => (
            <Text
              key={`${item.ref_id}-${i}`}
              variant="default"
              as="span"
              className="pl-6 text-xs text-su-white/50"
            >
              {item.name} ({item.scrap_cost} TL{item.scrap_tl} scrap)
            </Text>
          ))}
        </div>
      )}

      {isSkipped && craftedCount === 0 && (
        <div className="flex items-center gap-2">
          <Text variant="default" as="span" className="text-sm text-su-white/40">
            -- Skipped --
          </Text>
        </div>
      )}

      {!isSkipped && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={saving}
          className="flex w-full cursor-pointer items-center justify-center gap-2 bg-su-orange px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-su-white" /> : null}
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            {saving ? 'Crafting...' : 'Open Crafting'}
          </Text>
        </button>
      )}

      {!isSkipped && (
        <button
          type="button"
          onClick={handleSkip}
          className="flex w-full cursor-pointer items-center justify-center gap-2 border border-su-white/20 bg-su-black/30 px-4 py-2 transition-opacity hover:opacity-80"
        >
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white/50">
            Skip Crafting
          </Text>
        </button>
      )}

      <CraftSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        crawlerTL={crawler.tech_level}
        availableScrap={availableScrap}
        onCraft={handleCraft}
      />
    </div>
  )
}
