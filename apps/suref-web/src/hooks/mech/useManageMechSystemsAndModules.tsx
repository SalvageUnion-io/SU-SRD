import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useCreateEntity, useDeleteEntity } from '../suentity'
import { useHydratedMech } from './useHydratedMech'

export function useManageMechSystemsAndModules(id: string | undefined) {
  const { systems, modules } = useHydratedMech(id)
  const createEntity = useCreateEntity()
  const deleteEntity = useDeleteEntity()
  const handleAddSystem = useCallback(
    (systemId: string) => {
      if (!id) return

      const system = SalvageUnionReference.get('systems', systemId)
      if (!system) return

      createEntity.mutate({
        mech_id: id,
        schema_name: 'systems',
        schema_ref_id: systemId,
        metadata: {
          damaged: false,
        },
      })
    },
    [id, createEntity]
  )

  const handleRemoveSystem = useCallback(
    async (entityIdOrSchemaRefId: string) => {
      if (!id) return

      const entity =
        systems.find((e) => e.id === entityIdOrSchemaRefId) ||
        systems.find((e) => e.schema_ref_id === entityIdOrSchemaRefId)

      if (!entity) return

      deleteEntity.mutate({ id: entity.id, parentType: 'mech', parentId: id })
    },
    [id, systems, deleteEntity]
  )

  const handleAddModule = useCallback(
    async (moduleId: string) => {
      if (!id) return

      const module = SalvageUnionReference.get('modules', moduleId)
      if (!module) return

      createEntity.mutate({
        mech_id: id,
        schema_name: 'modules',
        schema_ref_id: moduleId,
        metadata: {
          damaged: false,
        },
      })
    },
    [id, createEntity]
  )

  const handleRemoveModule = useCallback(
    async (entityIdOrSchemaRefId: string) => {
      if (!id) return

      const entity =
        modules.find((e) => e.id === entityIdOrSchemaRefId) ||
        modules.find((e) => e.schema_ref_id === entityIdOrSchemaRefId)

      if (!entity) return

      deleteEntity.mutate({ id: entity.id, parentType: 'mech', parentId: id })
    },
    [id, modules, deleteEntity]
  )

  return {
    handleAddSystem,
    handleRemoveSystem,
    handleAddModule,
    handleRemoveModule,
  }
}
