import { useCallback } from 'react'
import { SalvageUnionReference, getEnergyPoints } from 'salvageunion-reference'
import { useHydratedMech } from './useHydratedMech'
import { useUpdateMech } from './useMechs'
import { useDeleteEntity, useCreateEntity } from '../suentity/useSUEntities'
import { useDeleteCargo } from '../cargo/useCargo'

export function useChangeMechChassis(id: string | undefined) {
  const { mech, systems, modules, cargo, selectedChassis } = useHydratedMech(id)
  const updateMech = useUpdateMech()
  const deleteEntity = useDeleteEntity()
  const createEntity = useCreateEntity()
  const deleteCargo = useDeleteCargo()

  return useCallback(
    async (chassisId: string | null) => {
      if (!id || !mech) return

      if (!chassisId) {
        if (selectedChassis) {
          deleteEntity.mutate({ id: selectedChassis.id, parentType: 'mech', parentId: id })
        }
        return
      }

      const isChangingChassis = selectedChassis && selectedChassis.schema_ref_id !== chassisId

      if (isChangingChassis) {
        const newChassis = SalvageUnionReference.Chassis.find((c) => c.id === chassisId)

        systems.forEach((system) => {
          deleteEntity.mutate({ id: system.id, parentType: 'mech', parentId: id })
        })

        modules.forEach((module) => {
          deleteEntity.mutate({ id: module.id, parentType: 'mech', parentId: id })
        })

        cargo.forEach((cargo) => {
          deleteCargo.mutate({ id: cargo.id, parentType: 'mech', parentId: id })
        })

        deleteEntity.mutate({ id: selectedChassis.id, parentType: 'mech', parentId: id })

        createEntity.mutate({
          mech_id: id,
          schema_name: 'chassis',
          schema_ref_id: chassisId,
        })

        updateMech.mutate({
          id,
          updates: {
            pattern: null,
            quirk: null,
            appearance: null,
            current_damage: 0,
            current_ep: newChassis ? (getEnergyPoints(newChassis) ?? 0) : 0,
            current_heat: 0,
            notes: null,
          },
        })
      } else if (!selectedChassis) {
        const newChassis = SalvageUnionReference.Chassis.find((c) => c.id === chassisId)
        createEntity.mutate({
          mech_id: id,
          schema_name: 'chassis',
          schema_ref_id: chassisId,
        })

        updateMech.mutate({
          id,
          updates: { current_ep: newChassis ? (getEnergyPoints(newChassis) ?? 0) : 0 },
        })
      }
    },
    [
      id,
      mech,
      updateMech,
      systems,
      modules,
      cargo,
      selectedChassis,
      deleteEntity,
      createEntity,
      deleteCargo,
    ]
  )
}
