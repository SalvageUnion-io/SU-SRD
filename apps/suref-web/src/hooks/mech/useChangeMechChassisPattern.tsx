import { useCallback } from 'react'
import type { SURefChassis } from 'salvageunion-reference'
import { useHydratedMech } from './useHydratedMech'
import { useCreateEntity, useDeleteEntity } from '../suentity'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useUpdateMech } from './useMechs'

export function useChangeMechChassisPattern(id: string | undefined) {
  const { selectedChassis, systems, modules } = useHydratedMech(id)
  const createEntity = useCreateEntity()
  const deleteEntity = useDeleteEntity()
  const updateMech = useUpdateMech()
  return useCallback(
    async (patternName: string) => {
      if (!id) return

      const chassisRef = selectedChassis?.ref as SURefChassis | undefined
      const matchingPattern = chassisRef?.patterns?.find(
        (p) => p.name.toLowerCase() === patternName.toLowerCase()
      )

      if (matchingPattern) {
        const hasExistingSystems = systems.length > 0 || modules.length > 0
        const message = hasExistingSystems
          ? `Do you want to apply the "${matchingPattern.name}" pattern? This will replace your current systems and modules.`
          : `Do you want to apply the "${matchingPattern.name}" pattern? This will add the pattern's systems and modules.`

        const confirmed = window.confirm(message)

        if (confirmed) {
          if (hasExistingSystems) {
            systems.forEach((system) => {
              deleteEntity.mutate({ id: system.id, parentType: 'mech', parentId: id })
            })

            modules.forEach((module) => {
              deleteEntity.mutate({ id: module.id, parentType: 'mech', parentId: id })
            })
          }

          matchingPattern.systems?.forEach((systemEntry) => {
            const system = SalvageUnionReference.get('systems', systemEntry.name)
            if (system) {
              const count =
                'count' in systemEntry && typeof systemEntry.count === 'number'
                  ? systemEntry.count
                  : 1

              for (let i = 0; i < count; i++) {
                createEntity.mutate({
                  mech_id: id,
                  schema_name: 'systems',
                  schema_ref_id: system.id,
                })
              }
            }
          })

          matchingPattern.modules?.forEach((moduleEntry) => {
            const module = SalvageUnionReference.get('modules', moduleEntry.name)
            if (module) {
              const count =
                'count' in moduleEntry && typeof moduleEntry.count === 'number'
                  ? moduleEntry.count
                  : 1

              for (let i = 0; i < count; i++) {
                createEntity.mutate({
                  mech_id: id,
                  schema_name: 'modules',
                  schema_ref_id: module.id,
                })
              }
            }
          })

          updateMech.mutate({
            id,
            updates: {
              pattern: patternName,
            },
          })
        } else {
          updateMech.mutate({
            id,
            updates: {
              pattern: patternName,
            },
          })
        }
      } else {
        updateMech.mutate({
          id,
          updates: {
            pattern: patternName,
          },
        })
      }
    },
    [id, selectedChassis, systems, modules, deleteEntity, createEntity, updateMech]
  )
}
