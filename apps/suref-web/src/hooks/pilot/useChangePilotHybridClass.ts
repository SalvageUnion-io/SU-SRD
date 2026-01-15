import { useCallback } from 'react'
import { useDeleteEntity, useCreateEntity } from '../suentity'
import { useHydratedPilot } from './useHydratedPilot'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefClass } from 'salvageunion-reference'
import { logger } from '../../lib/logger'

export function useChangePilotHybridClass(id: string | undefined) {
  const { pilot, abilities, selectedAdvancedClass } = useHydratedPilot(id)
  const deleteEntity = useDeleteEntity()
  const createEntity = useCreateEntity()

  return useCallback(
    async (hybridClassId: string | null) => {
      if (!id || !pilot) return

      if (!hybridClassId) {
        if (selectedAdvancedClass) {
          // When clearing hybrid class, delete all hybrid class abilities only
          const hybridClassRef = selectedAdvancedClass.ref as SURefClass
          const treesToDelete = new Set<string>()

          if ('advancedTree' in hybridClassRef && hybridClassRef.advancedTree) {
            treesToDelete.add(hybridClassRef.advancedTree)
          }
          if ('legendaryTree' in hybridClassRef && hybridClassRef.legendaryTree) {
            treesToDelete.add(hybridClassRef.legendaryTree)
          }

          abilities.forEach((ability) => {
            const abilityRef = ability.ref as { tree: string }
            if (treesToDelete.has(abilityRef.tree)) {
              deleteEntity.mutate({ id: ability.id, parentType: 'pilot', parentId: id })
            }
          })

          deleteEntity.mutate({
            id: selectedAdvancedClass.id,
            parentType: 'pilot',
            parentId: id,
          })
        }
        return
      }

      const hybridClass = SalvageUnionReference.get('classes', hybridClassId)
      const schemaName = 'classes'

      if (!hybridClass) {
        logger.error(`Hybrid class not found: ${hybridClassId}`)
        return
      }

      // Verify this is a hybrid class (hybrid === true)
      if (!('hybrid' in hybridClass && hybridClass.hybrid === true)) {
        logger.error(`Class ${hybridClassId} is not a hybrid class`)
        return
      }

      const isChangingHybridClass =
        selectedAdvancedClass && selectedAdvancedClass.schema_ref_id !== hybridClassId

      if (isChangingHybridClass) {
        // Only delete hybrid class abilities from the old hybrid class
        const oldHybridClassRef = selectedAdvancedClass.ref as SURefClass
        const treesToDelete = new Set<string>()

        if ('advancedTree' in oldHybridClassRef && oldHybridClassRef.advancedTree) {
          treesToDelete.add(oldHybridClassRef.advancedTree)
        }
        if ('legendaryTree' in oldHybridClassRef && oldHybridClassRef.legendaryTree) {
          treesToDelete.add(oldHybridClassRef.legendaryTree)
        }

        abilities.forEach((ability) => {
          const abilityRef = ability.ref as { tree: string }
          if (treesToDelete.has(abilityRef.tree)) {
            deleteEntity.mutate({ id: ability.id, parentType: 'pilot', parentId: id })
          }
        })

        deleteEntity.mutate({
          id: selectedAdvancedClass.id,
          parentType: 'pilot',
          parentId: id,
        })

        createEntity.mutate({
          pilot_id: id,
          schema_name: schemaName,
          schema_ref_id: hybridClassId,
        })
      } else if (!selectedAdvancedClass) {
        createEntity.mutate({
          pilot_id: id,
          schema_name: schemaName,
          schema_ref_id: hybridClassId,
        })
      }
    },
    [id, abilities, selectedAdvancedClass, deleteEntity, createEntity, pilot]
  )
}
