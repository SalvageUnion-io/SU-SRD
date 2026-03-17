import { useMemo, useCallback, useState } from 'react'
import { Text } from 'suref-react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useMech,
  useMechEntityRefs,
  useUpdateMech,
  useBatchRepairEntityRefs,
} from '../../../hooks/useMechs'
import { usePilot, useUpdatePilot } from '../../../hooks/usePilots'
import { useSaveRestoreReceipt } from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import {
  computeMechRestoreUpdate,
  computePilotRestoreUpdate,
  findRepairableRefs,
} from '../../../lib/restoreUtils'
import type { RestoreReceipt } from '../../../lib/restoreUtils'
import { deleteComradeEpChoices } from '../../../lib/api/playerChoiceApi'
import { getErrorMessage } from '../../../lib/errors'
import { Skeleton } from '../../ui/skeleton'
import type { DowntimeRecordRow } from '../../../types/common'

type RestoreStepProps = {
  mechId: string
  pilotId: string
  crawlerId: string
  crawlerTL: number
  activeDowntime: DowntimeRecordRow
  compact?: boolean
}

export function RestoreStep({
  mechId,
  pilotId,
  crawlerId,
  crawlerTL,
  activeDowntime,
}: RestoreStepProps) {
  const user = useCurrentUser()
  const { data: mech, isLoading: mechLoading } = useMech(mechId)
  const { data: pilot, isLoading: pilotLoading } = usePilot(pilotId)
  const { data: mechRefs, isLoading: mechRefsLoading } = useMechEntityRefs(mechId)

  const updateMech = useUpdateMech()
  const updatePilot = useUpdatePilot()
  const batchRepair = useBatchRepairEntityRefs()
  const saveReceipt = useSaveRestoreReceipt()

  const [mechRestoring, setMechRestoring] = useState(false)
  const [pilotRestoring, setPilotRestoring] = useState(false)

  const existingReceipt = useMemo(() => {
    const receipts = activeDowntime.restore_receipts as Record<string, RestoreReceipt> | null
    return receipts?.[pilotId] ?? null
  }, [activeDowntime.restore_receipts, pilotId])

  const mechDone = existingReceipt?.mech_restored ?? false
  const pilotDone = existingReceipt?.pilot_restored ?? false

  const saveReceiptUpdate = useCallback(
    (partial: Partial<RestoreReceipt>) => {
      const current: RestoreReceipt = existingReceipt ?? {
        mech_restored: false,
        pilot_restored: false,
        items_repaired: 0,
        comrades_healed: 0,
      }
      const merged = { ...current, ...partial }
      saveReceipt.mutate({
        recordId: activeDowntime.id,
        pilotId,
        receipt: merged,
        crawlerId,
      })
    },
    [existingReceipt, activeDowntime.id, pilotId, crawlerId, saveReceipt]
  )

  const handleRestoreMech = useCallback(async () => {
    if (!mech || !mechRefs || !user) return
    setMechRestoring(true)
    try {
      // 1. Restore mech stats (SP->max, EP->max, Heat->0)
      const mechUpdate = computeMechRestoreUpdate(mech)
      await new Promise<void>((resolve, reject) =>
        updateMech.mutate(
          { mechId, input: mechUpdate },
          { onSuccess: () => resolve(), onError: reject }
        )
      )

      // 2. Repair damaged systems/modules at TL <= crawlerTL
      const repairableIds = findRepairableRefs(mechRefs, crawlerTL)
      if (repairableIds.length > 0) {
        await new Promise<void>((resolve, reject) =>
          batchRepair.mutate(
            { refIds: repairableIds, mechId },
            { onSuccess: () => resolve(), onError: reject }
          )
        )
      }

      // 3. Heal comrades (delete EP overrides so they return to max)
      const comradesHealed = await deleteComradeEpChoices(pilotId)

      // 4. Save receipt
      saveReceiptUpdate({
        mech_restored: true,
        items_repaired: repairableIds.length,
        comrades_healed: comradesHealed,
      })

      toast.success('Mech restored!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setMechRestoring(false)
    }
  }, [mech, mechRefs, user, mechId, crawlerTL, pilotId, updateMech, batchRepair, saveReceiptUpdate])

  const handleRestorePilot = useCallback(async () => {
    if (!pilot || !user) return
    setPilotRestoring(true)
    try {
      const pilotUpdate = computePilotRestoreUpdate(pilot)
      await new Promise<void>((resolve, reject) =>
        updatePilot.mutate(
          { pilotId, input: pilotUpdate, userId: user.id },
          { onSuccess: () => resolve(), onError: reject }
        )
      )

      saveReceiptUpdate({ pilot_restored: true })
      toast.success('Pilot restored!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPilotRestoring(false)
    }
  }, [pilot, user, pilotId, updatePilot, saveReceiptUpdate])

  if (mechLoading || pilotLoading || mechRefsLoading || !mech || !pilot || !mechRefs) {
    return (
      <div role="status" aria-label="Loading..." className="flex flex-col gap-2 py-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  // Both done — show summary
  if (mechDone && pilotDone) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-su-green" />
          <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
            Mech & Pilot Restored
          </Text>
        </div>
        {existingReceipt && existingReceipt.items_repaired > 0 && (
          <Text variant="default" as="span" className="text-xs text-su-white/50">
            {existingReceipt.items_repaired} item{existingReceipt.items_repaired !== 1 ? 's' : ''}{' '}
            repaired
          </Text>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleRestoreMech}
        disabled={mechDone || mechRestoring || !mech || !mechRefs}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40 ${
          mechDone ? 'bg-su-green/20' : 'bg-su-orange'
        }`}
      >
        {mechRestoring ? (
          <Loader2 className="h-4 w-4 animate-spin text-su-white" />
        ) : mechDone ? (
          <Check className="h-4 w-4 text-su-green" />
        ) : null}
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
          {mechRestoring ? 'Restoring...' : mechDone ? 'Mech Restored' : 'Restore Mech'}
        </Text>
      </button>

      <button
        type="button"
        onClick={handleRestorePilot}
        disabled={pilotDone || pilotRestoring || !pilot}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40 ${
          pilotDone ? 'bg-su-green/20' : 'bg-su-green'
        }`}
      >
        {pilotRestoring ? (
          <Loader2 className="h-4 w-4 animate-spin text-su-white" />
        ) : pilotDone ? (
          <Check className="h-4 w-4 text-su-green" />
        ) : null}
        <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
          {pilotRestoring ? 'Restoring...' : pilotDone ? 'Pilot Restored' : 'Restore Pilot'}
        </Text>
      </button>
    </div>
  )
}
