import { EntitySelectionModal } from '../entity/EntitySelectionModal'

interface EquipmentSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectEquipment: (equipmentId: string) => void
}

export function EquipmentSelector({ isOpen, onClose, onSelectEquipment }: EquipmentSelectorProps) {
  return (
    <EntitySelectionModal
      isOpen={isOpen}
      onClose={onClose}
      schemaNames={['equipment']}
      onSelect={(equipmentId) => onSelectEquipment(equipmentId)}
      title="Add Equipment"
      selectButtonTextPrefix="Equip"
    />
  )
}
