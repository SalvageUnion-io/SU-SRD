import { useState, useMemo, useCallback } from 'react'
import { Text } from 'suref-react'
import { toast } from 'sonner'
import { useMech, useMechCargo, useAddMechCargo, useDeleteMechCargo } from '../../hooks/useMechs'
import { getErrorMessage } from '../../lib/errors'
import {
  cargoRowsToGridItems,
  computeGridColumns,
  computeGridDisplayCells,
  packItems,
  buildOccupancyMap,
  computeAllCells,
  getRemainingCapacity,
  formatScrapName,
} from '../../lib/cargoGridUtils'
import { CargoGrid } from '../shared/CargoGrid'
import { LoadCargoModal } from './LoadCargoModal'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { IsolatedStatValue } from '../shared/IsolatedStatValue'

type MechCargoSectionProps = {
  mechId: string
  userId: string
  readOnly?: boolean
}

export function MechCargoSection({ mechId, userId, readOnly }: MechCargoSectionProps) {
  const { data: mech } = useMech(mechId)
  const { data: cargo } = useMechCargo(mechId)
  const addCargo = useAddMechCargo()
  const deleteCargo = useDeleteMechCargo()

  const [showLoadModal, setShowLoadModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const cargoCapacity = mech?.cargo_capacity ?? 0

  // Derive grid data
  const gridItems = useMemo(() => cargoRowsToGridItems(cargo ?? []), [cargo])
  const remaining = useMemo(
    () => getRemainingCapacity(gridItems, cargoCapacity),
    [gridItems, cargoCapacity]
  )
  const columns = useMemo(() => computeGridColumns(cargoCapacity), [cargoCapacity])
  const displayCells = useMemo(
    () => computeGridDisplayCells(cargoCapacity, columns),
    [cargoCapacity, columns]
  )
  const placements = useMemo(
    () => packItems(gridItems, cargoCapacity, columns),
    [gridItems, cargoCapacity, columns]
  )
  const occupancyMap = useMemo(
    () => buildOccupancyMap(placements, displayCells),
    [placements, displayCells]
  )
  const cells = useMemo(
    () => computeAllCells(occupancyMap, placements, columns),
    [occupancyMap, placements, columns]
  )

  const usedCapacity = cargoCapacity - remaining

  // --- Handlers ---

  const handleAddEntity = useCallback(
    (schemaName: string, entityId: string, name: string) => {
      addCargo.mutate(
        {
          parentId: mechId,
          userId,
          input: {
            name,
            schema_name: schemaName,
            schema_ref_id: entityId,
          },
        },
        {
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mechId, userId, addCargo]
  )

  const handleAddCustom = useCallback(
    (name: string, techLevel: string | undefined, salvageValue: number) => {
      const metadata: Record<string, unknown> = { salvage_value: salvageValue }
      if (techLevel !== undefined) metadata.tech_level = techLevel
      addCargo.mutate(
        {
          parentId: mechId,
          userId,
          input: { name, metadata },
        },
        {
          onSuccess: () => setShowLoadModal(false),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mechId, userId, addCargo]
  )

  const handleAddScrap = useCallback(
    (techLevel: number, quantity: number) => {
      const name = formatScrapName(quantity, techLevel)
      addCargo.mutate(
        {
          parentId: mechId,
          userId,
          input: {
            name,
            amount: quantity,
            metadata: { tech_level: techLevel },
          },
        },
        {
          onSuccess: () => setShowLoadModal(false),
          onError: (err) => toast.error(getErrorMessage(err)),
        }
      )
    },
    [mechId, userId, addCargo]
  )

  const handleDeleteRequest = useCallback((cargoId: string, name: string) => {
    setDeleteTarget({ id: cargoId, name })
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return
    deleteCargo.mutate(
      { cargoId: deleteTarget.id, parentId: mechId },
      {
        onSuccess: () => setDeleteTarget(null),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }, [deleteTarget, mechId, deleteCargo])

  if (cargoCapacity === 0) {
    return (
      <div className="flex min-h-[80px] items-center justify-center">
        <Text variant="default" className="text-su-dark-gray/60 italic">
          No cargo capacity
        </Text>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <IsolatedStatValue
        bg="bg-su-green"
        stats={[{ key: 'cargo', label: 'Cargo Cap', value: usedCapacity, outOfMax: cargoCapacity }]}
        className="ml-auto"
      />

      {/* Grid */}
      {cargoCapacity > 0 && (
        <CargoGrid
          cells={cells}
          columns={columns}
          readOnly={readOnly}
          onDelete={handleDeleteRequest}
          onEmptyClick={!readOnly && remaining > 0 ? () => setShowLoadModal(true) : undefined}
        />
      )}

      {/* Load modal */}
      <LoadCargoModal
        open={showLoadModal}
        onOpenChange={setShowLoadModal}
        remainingCapacity={remaining}
        onAddEntity={handleAddEntity}
        onAddCustom={handleAddCustom}
        onAddScrap={handleAddScrap}
        isAdding={addCargo.isPending}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          entityType="Cargo Item"
          entityName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteCargo.isPending}
        />
      )}
    </div>
  )
}
