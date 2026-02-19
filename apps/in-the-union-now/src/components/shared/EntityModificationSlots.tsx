import type { SURefEntity } from 'salvageunion-reference'
import { useEntityModifications } from '../../hooks/useEntityModifications'
import { ItemSlotSection } from './ItemSlotSection'
import { ReferenceEntitySelectionModal } from '../patterns/ReferenceEntitySelectionModal'
import type { EntityRefRow } from '../../types/common'

type EntityModificationSlotsProps = {
  entity: SURefEntity
  mechId: string
  mechRefs: EntityRefRow[]
  userId: string
  compact?: boolean
  readOnly?: boolean
}

export function EntityModificationSlots({
  entity,
  mechId,
  mechRefs,
  userId,
  compact,
  readOnly,
}: EntityModificationSlotsProps) {
  const {
    playerSystemItems,
    playerModuleItems,
    capacity,
    modalTarget,
    openModal,
    closeModal,
    addItem,
    removeItem,
  } = useEntityModifications({ entity, mechId, mechRefs, userId })

  const hasSystemSlots =
    'systemSlots' in entity && typeof entity.systemSlots === 'number' && entity.systemSlots > 0
  const hasModuleSlots =
    'moduleSlots' in entity && typeof entity.moduleSlots === 'number' && entity.moduleSlots > 0

  if (!hasSystemSlots && !hasModuleSlots) return null

  const remainingSlots =
    modalTarget === 'systems'
      ? capacity.systemSlotsTotal - capacity.systemSlotsUsed
      : modalTarget === 'modules'
        ? capacity.moduleSlotsTotal - capacity.moduleSlotsUsed
        : 0

  const entityName = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'Entity'

  return (
    <>
      {/* Editable Systems & Modules — hidden in readOnly */}
      {!readOnly && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {hasSystemSlots && (
            <ItemSlotSection
              label="Systems"
              items={playerSystemItems}
              slotsUsed={capacity.systemSlotsUsed}
              slotsTotal={capacity.systemSlotsTotal}
              slotType="systems"
              hasChassis
              onRemove={removeItem}
              onAdd={openModal}
              compact={compact}
              showDetailButton
            />
          )}

          {hasModuleSlots && (
            <ItemSlotSection
              label="Modules"
              items={playerModuleItems}
              slotsUsed={capacity.moduleSlotsUsed}
              slotsTotal={capacity.moduleSlotsTotal}
              slotType="modules"
              hasChassis
              onRemove={removeItem}
              onAdd={openModal}
              compact={compact}
              showDetailButton
            />
          )}
        </div>
      )}

      {!readOnly && modalTarget && (
        <ReferenceEntitySelectionModal
          open
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
          title={`Add ${modalTarget === 'systems' ? 'System' : 'Module'} to ${entityName}`}
          schemaName={modalTarget}
          onSelect={addItem}
          remainingSlots={remainingSlots}
        />
      )}
    </>
  )
}
