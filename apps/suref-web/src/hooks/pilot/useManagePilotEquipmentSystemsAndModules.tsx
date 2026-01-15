import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useCreateEntity, useDeleteEntity } from '../suentity'
import { useHydratedPilot } from './useHydratedPilot'

export function useManagePilotEquipmentSystemsAndModules(
  pilotId: string | undefined,
  equipmentEntityId: string
) {
  const { systems, modules } = useHydratedPilot(pilotId)
  const createEntity = useCreateEntity()
  const deleteEntity = useDeleteEntity()

  // Filter systems/modules that are children of this equipment
  const equipmentSystems = systems.filter((s) => s.parent_entity_id === equipmentEntityId)
  const equipmentModules = modules.filter((m) => m.parent_entity_id === equipmentEntityId)

  const handleAddSystem = useCallback(
    (systemId: string) => {
      if (!pilotId) return

      const system = SalvageUnionReference.get('systems', systemId)
      if (!system) return

      createEntity.mutate({
        pilot_id: pilotId,
        parent_entity_id: equipmentEntityId,
        schema_name: 'systems',
        schema_ref_id: systemId,
      })
    },
    [pilotId, equipmentEntityId, createEntity]
  )

  const handleRemoveSystem = useCallback(
    async (entityIdOrSchemaRefId: string) => {
      if (!pilotId) return

      const entity =
        equipmentSystems.find((e) => e.id === entityIdOrSchemaRefId) ||
        equipmentSystems.find((e) => e.schema_ref_id === entityIdOrSchemaRefId)

      if (!entity) return

      deleteEntity.mutate({ id: entity.id, parentType: 'pilot', parentId: pilotId })
    },
    [pilotId, equipmentSystems, deleteEntity]
  )

  const handleAddModule = useCallback(
    async (moduleId: string) => {
      if (!pilotId) return

      const module = SalvageUnionReference.get('modules', moduleId)
      if (!module) return

      createEntity.mutate({
        pilot_id: pilotId,
        parent_entity_id: equipmentEntityId,
        schema_name: 'modules',
        schema_ref_id: moduleId,
      })
    },
    [pilotId, equipmentEntityId, createEntity]
  )

  const handleRemoveModule = useCallback(
    async (entityIdOrSchemaRefId: string) => {
      if (!pilotId) return

      const entity =
        equipmentModules.find((e) => e.id === entityIdOrSchemaRefId) ||
        equipmentModules.find((e) => e.schema_ref_id === entityIdOrSchemaRefId)

      if (!entity) return

      deleteEntity.mutate({ id: entity.id, parentType: 'pilot', parentId: pilotId })
    },
    [pilotId, equipmentModules, deleteEntity]
  )

  return {
    handleAddSystem,
    handleRemoveSystem,
    handleAddModule,
    handleRemoveModule,
    equipmentSystems,
    equipmentModules,
  }
}
