import { useState, useMemo, useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay, Text } from 'suref-react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useSaveEquipmentReceipt } from '../../../hooks/useCrawlers'
import { useCreateEntityRef } from '../../../hooks/usePilots'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { hasObtainedEquipment } from '../../../lib/equipmentUtils'
import type { EquipmentReceipt } from '../../../lib/equipmentUtils'
import { isPilotBayDamaged } from '../../../lib/bayDamageUtils'
import { getErrorMessage } from '../../../lib/errors'
import { getEntityId } from '../../../lib/entitySelectionUtils'
import { EquipmentSelectionModal } from './EquipmentSelectionModal'
import type { DowntimeRecordRow } from '../../../types/common'
import type { BayNpcData } from '../../../types/common'

type EquipmentStepProps = {
  pilotId: string
  crawlerId: string
  crawlerTL: number
  activeDowntime: DowntimeRecordRow
  bayNpcs: Record<string, BayNpcData>
}

export function EquipmentStep({
  pilotId,
  crawlerId,
  crawlerTL,
  activeDowntime,
  bayNpcs,
}: EquipmentStepProps) {
  const user = useCurrentUser()
  const saveReceipt = useSaveEquipmentReceipt()
  const createEntityRef = useCreateEntityRef()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const bayDamaged = isPilotBayDamaged(bayNpcs)

  const receipt = useMemo(() => {
    const receipts = activeDowntime.equipment_receipts as Record<string, EquipmentReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.equipment_receipts, pilotId])

  const obtained = hasObtainedEquipment(receipt)
  const isSkipped = receipt?.skipped === true

  const handleSkip = useCallback(() => {
    saveReceipt.mutate({
      recordId: activeDowntime.id,
      pilotId,
      receipt: { item: null, skipped: true },
      crawlerId,
    })
  }, [activeDowntime.id, pilotId, crawlerId, saveReceipt])

  const resolvedEntity = useMemo(() => {
    if (!receipt?.item) return null
    return SalvageUnionReference.get('equipment', receipt.item.ref_id)
  }, [receipt])

  const handleSelect = useCallback(
    async (entity: SURefEntity) => {
      if (!user) return
      setSaving(true)
      try {
        const entityId = getEntityId(entity)
        const entityName = 'name' in entity ? (entity.name as string) : 'Unknown'

        // Create entity_ref on pilot
        await new Promise<void>((resolve, reject) =>
          createEntityRef.mutate(
            {
              input: {
                parent_id: pilotId,
                parent_type: 'pilot',
                schema_name: 'equipment',
                schema_ref_id: entityId,
                user_id: user.id,
              },
              pilotId,
            },
            { onSuccess: () => resolve(), onError: reject }
          )
        )

        // Save receipt
        saveReceipt.mutate({
          recordId: activeDowntime.id,
          pilotId,
          receipt: { item: { ref_id: entityId, name: entityName } },
          crawlerId,
        })

        setModalOpen(false)
        toast.success(`Obtained ${entityName}`)
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    },
    [user, pilotId, crawlerId, activeDowntime.id, createEntityRef, saveReceipt]
  )

  if (bayDamaged) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="h-4 w-4 text-su-rust" />
        <Text variant="default" as="span" className="text-sm text-su-rust">
          Pilot Bay is damaged — equipment selection unavailable.
        </Text>
      </div>
    )
  }

  if (obtained && resolvedEntity) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-su-green" />
          <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
            Equipment Obtained
          </Text>
        </div>
        <ReferenceEntityDisplay data={resolvedEntity} compact />
      </div>
    )
  }

  if (obtained) {
    return (
      <div className="flex items-center gap-2">
        <Check className="h-4 w-4 text-su-green" />
        <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
          Equipment Obtained: {receipt?.item?.name}
        </Text>
      </div>
    )
  }

  if (isSkipped) {
    return (
      <div className="flex items-center gap-2">
        <Text variant="default" as="span" className="text-sm text-su-white/40">
          -- Skipped --
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={saving}
        className="flex w-full cursor-pointer items-center justify-center gap-2 bg-su-orange px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin text-su-white" /> : null}
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
          {saving ? 'Obtaining...' : 'Choose Equipment'}
        </Text>
      </button>

      <button
        type="button"
        onClick={handleSkip}
        className="flex w-full cursor-pointer items-center justify-center gap-2 border border-su-white/20 bg-su-black/30 px-4 py-2 transition-opacity hover:opacity-80"
      >
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white/50">
          Skip Equipment
        </Text>
      </button>

      <EquipmentSelectionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        crawlerTL={crawlerTL}
        onSelect={handleSelect}
      />
    </div>
  )
}
