import { Card } from '../shared/Card'
import { DynamicBay } from '../shared/DynamicBay'
import { useState } from 'react'
import { getTiltRotation } from '../../utils/tiltUtils'
import { CargoModal } from '../shared/CargoModal'
import { useManageCrawlerCargo } from '../../hooks/crawler/useManageCrawlerCargo'
import { useHydratedCrawler } from '../../hooks/crawler'

interface CargoBayProps {
  id: string
  disabled?: boolean
  readOnly?: boolean
}

export function StorageCargoBay({ disabled = false, readOnly = false, id }: CargoBayProps) {
  // Only calculate rotation on client to avoid hydration mismatch
  const [titleRotation] = useState(() => getTiltRotation())
  const [isCargoModalOpen, setIsCargoModalOpen] = useState(false)
  const [cargoPosition, setCargoPosition] = useState<{ row: number; col: number } | null>(null)
  const { storageBay, cargo, totalCargo } = useHydratedCrawler(id)
  const { handleAddCargo, handleRemoveCargo } = useManageCrawlerCargo(id)
  const damaged = storageBay?.metadata?.damaged ?? false

  return (
    <>
      <Card
        bg={damaged ? 'su.grey' : 'bg.builder.crawler'}
        w="full"
        justifyContent="flex-start"
        titleRotation={damaged ? titleRotation : 0}
        disabled={disabled}
      >
        <DynamicBay
          items={cargo}
          maxCapacity={25}
          onRemove={readOnly ? undefined : handleRemoveCargo}
          onAddClick={
            readOnly
              ? undefined
              : (position) => {
                  setCargoPosition(position)
                  setIsCargoModalOpen(true)
                }
          }
          disabled={disabled}
          singleCellMode
        />
      </Card>

      <CargoModal
        isOpen={isCargoModalOpen}
        onClose={() => {
          setIsCargoModalOpen(false)
          setCargoPosition(null)
        }}
        onAdd={handleAddCargo}
        maxCargo={54}
        currentCargo={totalCargo}
        backgroundColor="bg.builder.crawler"
        position={cargoPosition}
      />
    </>
  )
}
