import { useCallback } from 'react'
import { useHydratedMech } from './useHydratedMech'
import { useCreateCargo, useDeleteCargo } from '../cargo'
import { SalvageUnionReference } from 'salvageunion-reference'

type ConfirmFn = (options: { message: string }) => Promise<boolean>

export function useManageMechCargo(id: string, confirm: ConfirmFn) {
  const { cargo } = useHydratedMech(id)
  const deleteCargo = useDeleteCargo()

  const createCargo = useCreateCargo()

  const handleRemoveCargo = useCallback(
    async (cargoId: string) => {
      if (!id) return

      const cargoItem = cargo.find((c) => c.id === cargoId)
      if (!cargoItem) return

      const cargoName = cargoItem.name || 'this cargo'

      const confirmed = await confirm({
        message: `Are you sure you want to remove ${cargoName}?`,
      })
      if (confirmed) {
        deleteCargo.mutate({ id: cargoId, parentType: 'mech', parentId: id })
      }
    },
    [id, cargo, deleteCargo, confirm]
  )

  const handleAddCargo = useCallback(
    async (
      amount: number,
      name: string,
      _color: string,
      ref?: string,
      position?: { row: number; col: number }
    ) => {
      if (!id) return

      let schemaName: string | undefined
      let schemaRefId: string | undefined
      if (ref) {
        const parsed = SalvageUnionReference.parseRef(ref)
        if (parsed) {
          schemaName = parsed.schemaName
          schemaRefId = parsed.id
        }
      }

      createCargo.mutate({
        mech_id: id,
        name,
        amount,
        ...(schemaName && schemaRefId
          ? { schema_name: schemaName, schema_ref_id: schemaRefId }
          : {}),
        metadata: position ? { position } : null,
      })
    },
    [id, createCargo]
  )
  return { handleRemoveCargo, handleAddCargo }
}
