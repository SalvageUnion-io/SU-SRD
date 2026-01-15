import { useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { useCreateCargo, useDeleteCargo } from '../cargo'
import { useHydratedCrawler } from './useHydratedCrawler'

export function useManageCrawlerCargo(id: string) {
  const { cargo: cargoItems } = useHydratedCrawler(id)
  const createCargo = useCreateCargo()
  const deleteCargo = useDeleteCargo()
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
        crawler_id: id,
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

  const handleRemoveCargo = useCallback(
    async (cargoId: string) => {
      if (!id) return

      const cargo = cargoItems.find((c) => c.id === cargoId)
      if (!cargo) return

      const cargoName = cargo.name || 'this cargo'

      if (window.confirm(`Are you sure you want to remove ${cargoName}?`)) {
        deleteCargo.mutate({ id: cargoId, parentType: 'crawler', parentId: id })
      }
    },
    [id, cargoItems, deleteCargo]
  )
  return { handleAddCargo, handleRemoveCargo }
}
