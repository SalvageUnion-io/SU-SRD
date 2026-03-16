import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName } from 'salvageunion-reference'
import { toast } from 'sonner'
import { showSaveToast } from '../lib/toastUtils'
import { getErrorMessage } from '../lib/errors'
import { changeLogApi } from '../lib/api/changeLogApi'
import type { EntityRefInsert, EntityRefUpdate, PilotUpdate } from '../types/common'
import type { PilotSheetMutationDeps } from './usePilotSheetMutations'

/**
 * Pilot-specific mutation handlers: pilot updates, stat changes,
 * and pilot entity ref CRUD.
 */
export function usePilotSheetPilotMutations(deps: PilotSheetMutationDeps) {
  const { user, pilot, pilotRefs, mutations } = deps
  const { updatePilot, updateEntityRef, deleteEntityRefMutation, createEntityRefMutation } =
    mutations

  const handlePilotUpdate = useCallback(
    (input: Partial<PilotUpdate>, toastMessage?: string) => {
      if (!user || !pilot) return
      updatePilot.mutate(
        { pilotId: pilot.id, input, userId: user.id },
        {
          onSuccess: () => showSaveToast(toastMessage ?? `${pilot.callsign} updated`),
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
      handlePilotUpdate(
        { [field]: newValue },
        `${pilot.callsign} ${field.toUpperCase()} ${oldValue} → ${newValue}`
      )
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
      const ref = pilotRefs.find((r) => r.id === refId)
      const refName = ref
        ? SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id)?.name
        : undefined
      updateEntityRef.mutate(
        { refId, input, pilotId: pilot.id },
        {
          onSuccess: () => {
            if (input.condition) {
              showSaveToast(`${refName ?? 'Equipment'} → ${input.condition}`)
            } else if (input.schema_ref_id && ref) {
              const newEntity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                input.schema_ref_id
              )
              showSaveToast(
                `${pilot.callsign} swapped ${refName ?? 'item'} → ${newEntity?.name ?? 'item'}`
              )
            } else {
              showSaveToast(`${pilot.callsign} updated`)
            }
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
            if (input.schema_ref_id && ref && input.schema_ref_id !== ref.schema_ref_id) {
              const oldEntity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                ref.schema_ref_id
              )
              const newEntity = SalvageUnionReference.get(
                ref.schema_name as EntitySchemaName,
                input.schema_ref_id
              )
              changeLogApi
                .log(user.id, {
                  targetId: refId,
                  targetType: 'entity_ref',
                  action: 'update',
                  field: 'schema_ref_id',
                  oldValue: ref.schema_ref_id,
                  newValue: input.schema_ref_id,
                  description: `${pilot.callsign} swapped ${oldEntity?.name ?? ref.schema_ref_id} → ${newEntity?.name ?? input.schema_ref_id}`,
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

  const handleDeleteEntityRef = useCallback(
    (refId: string) => {
      if (!pilot || !user) return
      const ref = pilotRefs.find((r) => r.id === refId)
      const refName = ref
        ? SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id)?.name
        : undefined
      deleteEntityRefMutation.mutate(
        { refId, pilotId: pilot.id },
        {
          onSuccess: () => showSaveToast(`${refName ?? 'Equipment'} removed`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilot, user, pilotRefs, deleteEntityRefMutation]
  )

  const handleCreateEntityRef = useCallback(
    (input: EntityRefInsert) => {
      if (!pilot || !user) return
      const entity = SalvageUnionReference.get(
        input.schema_name as EntitySchemaName,
        input.schema_ref_id
      )
      createEntityRefMutation.mutate(
        { input, pilotId: pilot.id },
        {
          onSuccess: () => showSaveToast(`${entity?.name ?? 'Equipment'} added`),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [pilot, user, createEntityRefMutation]
  )

  return {
    handlePilotUpdate,
    handleStatChange,
    handleUpdateEntityRef,
    handleDeleteEntityRef,
    handleCreateEntityRef,
  }
}
