import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SalvageUnionReference, isHybridClass, getAssetUrl } from 'salvageunion-reference'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { useAuthStore } from '../stores/authStore'
import {
  usePilot,
  usePilotEntityRefs,
  useUpdatePilot,
  useDeletePilot,
  useUpdateEntityRef,
  pilotKeys,
} from './usePilots'
import {
  useMech,
  useMechEntityRefs,
  useUpdateMech,
  useUpdateMechEntityRef,
  mechKeys,
} from './useMechs'
import { useSaveStatus } from './useSaveStatus'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { getEntityAccess } from '../lib/entityAccess'
import { findChassisById } from '../lib/entityHelpers'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import type { EntityRefUpdate, MechUpdate, PilotUpdate } from '../types/common'

export type PilotEditConfig = {
  canEdit: boolean
  saveStatusText: string
  onPilotUpdate: (input: Partial<PilotUpdate>) => void
  onStatChange: (field: 'hp' | 'ap' | 'tp', value: number) => void
  onUpdateEntityRef: (refId: string, input: EntityRefUpdate) => void
  onUpdateMech: (input: Partial<MechUpdate>) => void
  onUpdateMechEntityRef: (refId: string, input: EntityRefUpdate) => void
  onDelete: () => void
  onToggleVisibility: () => void
  isDeleting: boolean
}

export function usePilotSheet(pilotId: string) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: pilot, isLoading, error } = usePilot(pilotId)
  const { data: pilotRefs } = usePilotEntityRefs(pilotId)
  const updatePilot = useUpdatePilot()
  const updateEntityRef = useUpdateEntityRef()
  const deletePilot = useDeletePilot()
  const [showDelete, setShowDelete] = useState(false)

  const { data: mech, isLoading: mechLoading } = useMech(pilot?.mech_id ?? undefined)
  const { data: mechRefs } = useMechEntityRefs(mech?.id)
  const updateMech = useUpdateMech()
  const updateMechEntityRef = useUpdateMechEntityRef()

  // Realtime: sync pilot, entity refs, mech, and mech entity refs across clients
  useRealtimeSubscription('pilots', `id=eq.${pilotId}`, [pilotKeys.detail(pilotId)])
  useRealtimeSubscription('entity_refs', `parent_id=eq.${pilotId}`, [pilotKeys.entityRefs(pilotId)])
  useRealtimeSubscription('mechs', pilot?.mech_id ? `id=eq.${pilot.mech_id}` : undefined, [
    mechKeys.detail(pilot?.mech_id ?? ''),
  ])
  useRealtimeSubscription('entity_refs', mech ? `parent_id=eq.${mech.id}` : undefined, [
    mechKeys.entityRefs(mech?.id ?? ''),
  ])

  const pilotSaveStatus = useSaveStatus({
    isSaving:
      updatePilot.isPending ||
      updateEntityRef.isPending ||
      updateMech.isPending ||
      updateMechEntityRef.isPending,
  })

  const pilotClass = useMemo(
    () => (pilot ? SalvageUnionReference.get('classes', pilot.class_ref) : undefined),
    [pilot]
  )
  const cardColor = pilotClass && isHybridClass(pilotClass) ? 'bg-su-pink' : 'bg-su-orange'
  const pilotClassName = pilotClass?.name ?? 'Unknown'
  const pilotClassAssetUrl = pilotClass ? getAssetUrl(pilotClass) : undefined
  const abilityCount = useMemo(
    () => (pilotRefs ?? []).filter((r) => r.schema_name === 'abilities').length,
    [pilotRefs]
  )

  const mechChassis = useMemo(() => (mech ? findChassisById(mech.chassis_ref) : undefined), [mech])
  const chassisName = mechChassis?.name
  const patternName = mech?.pattern_name ? `\u201C${mech.pattern_name}\u201D` : undefined

  const access = pilot ? getEntityAccess(pilot, user?.id) : undefined
  const canEdit = access?.canView ? access.canEdit : false

  const handlePilotUpdate = useCallback(
    (input: Partial<PilotUpdate>) => {
      if (!user || !pilot) return
      updatePilot.mutate(
        { pilotId: pilot.id, input, userId: user.id },
        {
          onSuccess: showSaveToast,
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [user, pilot, updatePilot]
  )

  const handleStatChange = useCallback(
    (field: 'hp' | 'ap' | 'tp', newValue: number) => {
      if (!pilot || !user) return
      const oldValue = pilot[field]
      handlePilotUpdate({ [field]: newValue })
      changeLogApi
        .log(user.id, {
          targetId: pilot.id,
          targetType: 'pilot',
          action: 'update',
          field,
          oldValue,
          newValue,
          description: `${pilot.callsign} ${field.toUpperCase()} ${oldValue} → ${newValue}`,
        })
        .catch(() => {})
    },
    [pilot, user, handlePilotUpdate]
  )

  const handleUpdateEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!pilot || !user) return
      const ref = (pilotRefs ?? []).find((r) => r.id === refId)
      updateEntityRef.mutate(
        { refId, input, pilotId: pilot.id },
        {
          onSuccess: () => {
            showSaveToast()
            if (input.condition && ref) {
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: ref.condition,
                  newValue: input.condition,
                  description: `${pilot.callsign} equipment → ${input.condition}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilot, user, pilotRefs, updateEntityRef]
  )

  const handleUpdateMech = useCallback(
    (input: Partial<MechUpdate>) => {
      if (!mech || !user) return
      updateMech.mutate(
        { mechId: mech.id, input },
        {
          onSuccess: () => {
            showSaveToast()
            for (const [field, newValue] of Object.entries(input)) {
              const oldValue = mech[field as keyof typeof mech]
              changeLogApi
                .log(user.id, {
                  targetId: mech.id,
                  targetType: 'mech',
                  action: 'update',
                  field,
                  oldValue: oldValue as unknown,
                  newValue,
                  description: `Mech ${field} ${oldValue} → ${newValue}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, updateMech]
  )

  const handleUpdateMechEntityRef = useCallback(
    (refId: string, input: EntityRefUpdate) => {
      if (!mech || !user) return
      const ref = (mechRefs ?? []).find((r) => r.id === refId)
      updateMechEntityRef.mutate(
        { refId, input, mechId: mech.id },
        {
          onSuccess: () => {
            showSaveToast()
            if (input.condition && ref) {
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'condition',
                  oldValue: ref.condition,
                  newValue: input.condition,
                  description: `Mech loadout → ${input.condition}`,
                })
                .catch(() => {})
            }
          },
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mech, user, mechRefs, updateMechEntityRef]
  )

  const handleDelete = useCallback(() => {
    if (!user) return
    deletePilot.mutate(
      { pilotId, userId: user.id },
      {
        onSuccess: () => {
          toast.success('Pilot deleted')
          navigate({ to: '/' })
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [user, pilotId, deletePilot, navigate])

  const handleToggleVisibility = useCallback(() => {
    if (!pilot) return
    handlePilotUpdate({ visible: !pilot.visible })
  }, [pilot, handlePilotUpdate])

  const editConfig: PilotEditConfig | undefined = access?.canView
    ? {
        canEdit,
        saveStatusText: pilotSaveStatus.statusText,
        onPilotUpdate: handlePilotUpdate,
        onStatChange: handleStatChange,
        onUpdateEntityRef: handleUpdateEntityRef,
        onUpdateMech: handleUpdateMech,
        onUpdateMechEntityRef: handleUpdateMechEntityRef,
        onDelete: handleDelete,
        onToggleVisibility: handleToggleVisibility,
        isDeleting: deletePilot.isPending,
      }
    : undefined

  return {
    pilot,
    pilotRefs: pilotRefs ?? [],
    mech,
    mechRefs: mechRefs ?? [],
    mechLoading,
    mechChassis,
    isLoading,
    error,
    access,
    pilotClass,
    cardColor,
    pilotClassName,
    pilotClassAssetUrl,
    abilityCount,
    chassisName,
    patternName,
    editConfig,
    showDelete,
    setShowDelete,
  }
}
