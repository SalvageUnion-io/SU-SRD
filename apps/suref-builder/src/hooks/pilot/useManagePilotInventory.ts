import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useHydratedPilot } from './useHydratedPilot'
import { useCreateEntity, useDeleteEntity } from '../suentity'

type ConfirmFn = (options: { message: string }) => Promise<boolean>

export function useManagePilotInventory(id: string | undefined, confirm: ConfirmFn) {
  const { equipment } = useHydratedPilot(id)
  const deleteEntity = useDeleteEntity()
  const createEntity = useCreateEntity()
  const handleAddEquipment = useCallback(
    async (equipmentId: string) => {
      if (!id) return

      const equip = SalvageUnionReference.get('equipment', equipmentId)
      if (!equip) return

      createEntity.mutate({
        pilot_id: id,
        schema_name: 'equipment',
        schema_ref_id: equipmentId,
      })
    },
    [id, createEntity]
  )

  const handleRemoveEquipment = useCallback(
    async (entityId: string) => {
      if (!id) return

      const entity = equipment.find((e) => e.id === entityId)
      if (!entity) return

      const equipmentName = entity.ref.name || 'this equipment'

      const confirmed = await confirm({
        message: `Are you sure you want to remove ${equipmentName}?`,
      })
      if (confirmed) {
        deleteEntity.mutate({ id: entity.id, parentType: 'pilot', parentId: id })
      }
    },
    [id, equipment, deleteEntity, confirm]
  )
  return { handleAddEquipment, handleRemoveEquipment }
}
