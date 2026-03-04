import { useState, useMemo, useCallback, useEffect } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { Text } from 'suref-react'
import { Check, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  usePilot,
  useUpdatePilot,
  usePilotEntityRefs,
  useCreateEntityRef,
} from '../../../hooks/usePilots'
import { useSaveTrainingReceipt } from '../../../hooks/useCrawlers'
import { useCurrentUser } from '../../../hooks/useCurrentUser'
import { isPilotBayDamaged } from '../../../lib/bayDamageUtils'
import { getAbilityCost, countAbilitiesByTier, hasReceivedTP } from '../../../lib/trainingUtils'
import type { TrainingReceipt } from '../../../lib/trainingUtils'
import { getErrorMessage } from '../../../lib/errors'
import { getEntityId } from '../../../lib/entitySelectionUtils'
import { TrainingAbilityModal } from './TrainingAbilityModal'
import type { DowntimeRecordRow } from '../../../types/common'
import type { BayNpcData } from '../../../types/common'

type TrainStepProps = {
  pilotId: string
  crawlerId: string
  crawlerTL: number
  activeDowntime: DowntimeRecordRow
  bayNpcs: Record<string, BayNpcData>
}

export function TrainStep({
  pilotId,
  crawlerId,
  crawlerTL,
  activeDowntime,
  bayNpcs,
}: TrainStepProps) {
  const user = useCurrentUser()
  const { data: pilot } = usePilot(pilotId)
  const { data: pilotRefs } = usePilotEntityRefs(pilotId)
  const updatePilot = useUpdatePilot()
  const createEntityRef = useCreateEntityRef()
  const saveReceipt = useSaveTrainingReceipt()
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const bayDamaged = isPilotBayDamaged(bayNpcs)

  const receipt = useMemo(() => {
    const receipts = activeDowntime.training_receipts as Record<string, TrainingReceipt> | null
    return receipts?.[pilotId] ?? undefined
  }, [activeDowntime.training_receipts, pilotId])

  // Grant +1 TP on first render if not yet granted this downtime (idempotent)
  const tpGranted = hasReceivedTP(receipt)

  useEffect(() => {
    if (!pilot || !user || tpGranted || bayDamaged) return

    // Grant TP and create initial receipt
    const newTp = pilot.tp + 1
    updatePilot.mutate(
      { pilotId, input: { tp: newTp }, userId: user.id },
      {
        onSuccess: () => {
          saveReceipt.mutate({
            recordId: activeDowntime.id,
            pilotId,
            receipt: {
              tp_granted: 1,
              abilities_learned: [],
              tp_remaining: newTp,
            },
            crawlerId,
          })
        },
      }
    )
  }, [pilot?.id, tpGranted, bayDamaged]) // eslint-disable-line react-hooks/exhaustive-deps

  const existingAbilityIds = useMemo(() => {
    if (!pilotRefs) return new Set<string>()
    return new Set(
      pilotRefs.filter((r) => r.schema_name === 'abilities').map((r) => r.schema_ref_id)
    )
  }, [pilotRefs])

  const abilityCounts = useMemo(
    () => (pilotRefs ? countAbilitiesByTier(pilotRefs) : { core: 0, advanced: 0, legendary: 0 }),
    [pilotRefs]
  )

  const handleLearn = useCallback(
    async (entity: SURefEntity) => {
      if (!pilot || !user) return
      setSaving(true)
      try {
        const entityId = getEntityId(entity)
        const entityName = 'name' in entity ? (entity.name as string) : 'Unknown'
        const level = 'level' in entity ? entity.level : 1
        const cost = getAbilityCost(level as number | string)

        if (pilot.tp < cost) {
          toast.error('Not enough TP')
          return
        }

        // Deduct TP
        const newTp = pilot.tp - cost
        await new Promise<void>((resolve, reject) =>
          updatePilot.mutate(
            { pilotId, input: { tp: newTp }, userId: user.id },
            { onSuccess: () => resolve(), onError: reject }
          )
        )

        // Create entity_ref on pilot
        await new Promise<void>((resolve, reject) =>
          createEntityRef.mutate(
            {
              input: {
                parent_id: pilotId,
                parent_type: 'pilot',
                schema_name: 'abilities',
                schema_ref_id: entityId,
                user_id: user.id,
              },
              pilotId,
            },
            { onSuccess: () => resolve(), onError: reject }
          )
        )

        // Update receipt
        const newReceipt: TrainingReceipt = {
          tp_granted: receipt?.tp_granted ?? 1,
          abilities_learned: [
            ...(receipt?.abilities_learned ?? []),
            { ref_id: entityId, name: entityName, tp_cost: cost },
          ],
          tp_remaining: newTp,
        }
        saveReceipt.mutate({
          recordId: activeDowntime.id,
          pilotId,
          receipt: newReceipt,
          crawlerId,
        })

        setModalOpen(false)
        toast.success(`Learned ${entityName}`)
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setSaving(false)
      }
    },
    [
      pilot,
      user,
      pilotId,
      crawlerId,
      activeDowntime.id,
      receipt,
      updatePilot,
      createEntityRef,
      saveReceipt,
    ]
  )

  if (bayDamaged) {
    return (
      <div className="flex items-center gap-2 py-2">
        <AlertTriangle className="h-4 w-4 text-su-rust" />
        <Text variant="default" as="span" className="text-sm text-su-rust">
          Pilot Bay is damaged — training unavailable.
        </Text>
      </div>
    )
  }

  if (!pilot) return null

  const learnedCount = receipt?.abilities_learned.length ?? 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Text variant="pseudoheader" as="span" className="text-sm">
          Training Points: {pilot.tp}
        </Text>
      </div>

      <Text variant="default" as="p" className="text-[10px] text-su-white/40">
        Core = 1 TP, Advanced/Hybrid = 2 TP, Legendary = 3 TP
      </Text>

      {learnedCount > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-su-green" />
            <Text variant="pseudoheader" as="span" className="text-sm text-su-green">
              Learned {learnedCount} abilit{learnedCount !== 1 ? 'ies' : 'y'}
            </Text>
          </div>
          {receipt!.abilities_learned.map((a, i) => (
            <Text
              key={`${a.ref_id}-${i}`}
              variant="default"
              as="span"
              className="pl-6 text-xs text-su-white/50"
            >
              {a.name} ({a.tp_cost} TP)
            </Text>
          ))}
        </div>
      )}

      {pilot.tp > 0 && (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={saving}
          className="flex w-full cursor-pointer items-center justify-center gap-2 bg-su-orange px-4 py-2.5 transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin text-su-white" /> : null}
          <Text variant="pseudoheader" as="span" className="text-sm text-su-white">
            {saving ? 'Learning...' : 'Choose Ability'}
          </Text>
        </button>
      )}

      {pilot.tp <= 0 && learnedCount === 0 && (
        <Text variant="default" as="p" className="text-xs text-su-white/40">
          No TP available for training.
        </Text>
      )}

      <TrainingAbilityModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        classRef={pilot.class_ref}
        crawlerTL={crawlerTL}
        existingAbilityIds={existingAbilityIds}
        abilityCounts={abilityCounts}
        currentTP={pilot.tp}
        onSelect={handleLearn}
      />
    </div>
  )
}
