import type { SURefEntity, ItemCondition } from 'salvageunion-reference'
import { DualColumnLayout } from 'suref-react'
import { useEntityModifications } from '../../hooks/useEntityModifications'
import { ItemSlotSection } from './ItemSlotSection'
import { ReferenceEntitySelectionModal } from '../patterns/ReferenceEntitySelectionModal'
import type { EntityRefRow } from '../../types/common'

type EntityModificationSlotsProps = {
  entity: SURefEntity
  mechId: string
  mechRefs: EntityRefRow[]
  userId?: string
  compact?: boolean
  readOnly?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function EntityModificationSlots({
  entity,
  mechId,
  mechRefs,
  userId,
  compact,
  readOnly,
  onConditionChange,
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
      <DualColumnLayout
        left={
          hasSystemSlots ? (
            <ItemSlotSection
              label="Systems"
              items={playerSystemItems}
              slotsUsed={capacity.systemSlotsUsed}
              slotsTotal={capacity.systemSlotsTotal}
              slotType="systems"
              readOnly={readOnly}
              hasChassis
              onRemove={removeItem}
              onAdd={openModal}
              compact={compact}
              showDetailButton
              entityRefs={mechRefs}
              onConditionChange={onConditionChange}
            />
          ) : undefined
        }
        right={
          hasModuleSlots ? (
            <ItemSlotSection
              label="Modules"
              items={playerModuleItems}
              slotsUsed={capacity.moduleSlotsUsed}
              slotsTotal={capacity.moduleSlotsTotal}
              slotType="modules"
              readOnly={readOnly}
              hasChassis
              onRemove={removeItem}
              onAdd={openModal}
              compact={compact}
              showDetailButton
              entityRefs={mechRefs}
              onConditionChange={onConditionChange}
            />
          ) : undefined
        }
      />

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
