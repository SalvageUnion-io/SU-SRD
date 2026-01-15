import { StatDisplay } from '../StatDisplay'
import { Card } from '../shared/Card'
import { DynamicBay } from '../shared/DynamicBay'
import { CargoModal } from '../shared/CargoModal'
import { useState } from 'react'
import type { SURefChassis } from 'salvageunion-reference'
import { getCargoCapacity } from 'salvageunion-reference'
import { useManageMechCargo } from '../../hooks/mech/useManageMechCargo'
import { useHydratedMech } from '../../hooks/mech'

interface CargoListProps {
  disabled?: boolean
  id: string
  /** Hides add/remove buttons when viewing another player's sheet */
  readOnly?: boolean
}

export function CargoList({ id, disabled = false, readOnly = false }: CargoListProps) {
  const { cargo, selectedChassis, totalCargo } = useHydratedMech(id)
  const chassisRef = selectedChassis?.ref as SURefChassis | undefined
  const maxCargo = chassisRef ? (getCargoCapacity(chassisRef) ?? 0) : 0
  const canAddCargo = !!selectedChassis && !readOnly
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false)
  const [cargoPosition, setCargoPosition] = useState<{ row: number; col: number } | null>(null)
  const { handleAddCargo, handleRemoveCargo } = useManageMechCargo(id)
  const onAddClick = (position: { row: number; col: number }) => {
    setCargoPosition(position)
    setIsCargoModalOpen(true)
  }
  return (
    <>
      <Card
        bg="bg.builder.mech"
        title="Cargo"
        disabled={disabled}
        rightContent={
          <StatDisplay
            label="Cargo"
            value={totalCargo}
            outOfMax={maxCargo}
            disabled={disabled}
            hoverText="A Mech's Cargo Slots represents how much it can carry. By default a Mech has 6 Cargo Slots. Cargo Capacity can be increased by installing Systems such as Transport Holds or Cargo Bays into your Mech, as well as from some unique Chassis and Pilot Abilities."
          />
        }
      >
        <DynamicBay
          items={cargo}
          maxCapacity={maxCargo}
          onRemove={readOnly ? undefined : handleRemoveCargo}
          onAddClick={canAddCargo ? onAddClick : undefined}
          disabled={disabled}
        />
      </Card>
      <CargoModal
        isOpen={isCargoModalOpen}
        onClose={() => {
          setIsCargoModalOpen(false)
          setCargoPosition(null)
        }}
        onAdd={handleAddCargo}
        maxCargo={maxCargo}
        currentCargo={totalCargo}
        position={cargoPosition}
      />
    </>
  )
}
