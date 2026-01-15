import { useCallback } from 'react'
import { SalvageUnionReference, type SURefAbility, type SURefClass } from 'salvageunion-reference'
import { getAbilityCost } from '../../components/PilotLiveSheet/utils/getAbilityCost'
import { useHydratedPilot } from './useHydratedPilot'
import { useCreateEntity, useDeleteEntity } from '../suentity'
import { useUpdatePilot } from './usePilots'
import { logger } from '../../lib/logger'

export function useManagePilotAbilities(id: string | undefined) {
  const { pilot, abilities, selectedClass, selectedAdvancedClass } = useHydratedPilot(id)
  const createEntity = useCreateEntity()
  const updatePilot = useUpdatePilot()
  const deleteEntity = useDeleteEntity()

  const handleAddAbility = useCallback(
    async (abilityId: string) => {
      if (!id) return

      const ability = SalvageUnionReference.get('abilities', abilityId)
      if (!ability) return

      const cost = getAbilityCost(
        ability,
        selectedClass?.ref as SURefClass | undefined,
        selectedAdvancedClass?.ref as SURefClass | undefined
      )

      if ((pilot?.current_tp ?? 0) < cost) {
        alert(`Not enough TP. This ability costs ${cost} TP.`)
        return
      }

      createEntity.mutate(
        {
          pilot_id: id,
          schema_name: 'abilities',
          schema_ref_id: abilityId,
        },
        {
          onSuccess: () => {
            updatePilot.mutate({
              id,
              updates: {
                current_tp: (pilot?.current_tp ?? 0) - cost,
              },
            })
          },
          onError: (err) => {
            logger.error('Failed to add ability:', err)
          },
        }
      )
    },
    [id, pilot, selectedClass, selectedAdvancedClass, createEntity, updatePilot]
  )

  const handleRemoveAbility = useCallback(
    (entityId: string) => {
      if (!id) return

      const entity = abilities.find((e) => e.ref.id === entityId)
      if (!entity) return

      const ability = entity.ref as SURefAbility
      const abilityName = ability.name || 'this ability'

      if (window.confirm(`Are you sure you want to remove "${abilityName}"? It will cost 1 TP.`)) {
        deleteEntity.mutate(
          { id: entity.id, parentType: 'pilot', parentId: id },
          {
            onSuccess: () => {
              updatePilot.mutate({
                id,
                updates: {
                  current_tp: (pilot?.current_tp ?? 0) - 1,
                },
              })
            },
            onError: (err) => {
              logger.error('Failed to remove ability:', err)
            },
          }
        )
      }
    },
    [id, pilot, abilities, deleteEntity, updatePilot]
  )

  return { handleAddAbility, handleRemoveAbility }
}
