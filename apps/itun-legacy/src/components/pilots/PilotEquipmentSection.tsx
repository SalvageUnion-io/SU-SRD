import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference, PILOT_DEFAULTS, getInventorySlots } from 'salvageunion-reference'
import type { EntitySchemaName, ItemCondition, SURefEntity } from 'salvageunion-reference'
import { SectionSeparator, deleteControl } from 'suref-react'
import { Plus } from 'lucide-react'
import { makeConditionControl } from '../shared/ConditionToggle'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { ReferenceEntityPickerModal } from '../shared/ReferenceEntityPickerModal'
import { resolveGrantedEquipment } from '../../lib/grantUtils'
import type { EntityRefRow } from '../../types/common'

type PilotEquipmentSectionProps = {
  refs: EntityRefRow[]
  compact?: boolean
  canEdit?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
  onRemove?: (refId: string) => void
  onAdd?: (schemaRefId: string) => void
}

export function PilotEquipmentSection({
  refs,
  compact,
  canEdit,
  onConditionChange,
  onRemove,
  onAdd,
}: PilotEquipmentSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])
  const abilityRefs = useMemo(() => refs.filter((r) => r.schema_name === 'abilities'), [refs])

  const allEquipment = useMemo(() => SalvageUnionReference.Equipment.all() as SURefEntity[], [])

  // Granted equipment from abilities (virtual, not stored as entity_refs)
  const grantedEquipment = useMemo(() => resolveGrantedEquipment(abilityRefs), [abilityRefs])

  // Resolve user-added equipment entity_refs
  const resolvedEquipment = useMemo(() => {
    return equipmentRefs.map((ref) => {
      const entity = SalvageUnionReference.get(
        ref.schema_name as EntitySchemaName,
        ref.schema_ref_id
      ) as SURefEntity | undefined
      const slots = entity ? getInventorySlots(entity) : 1
      return { ref, entity, slots }
    })
  }, [equipmentRefs])

  // Granted equipment with slot costs
  const resolvedGranted = useMemo(() => {
    return grantedEquipment.map((entity) => ({
      entity,
      slots: getInventorySlots(entity),
    }))
  }, [grantedEquipment])

  const slotsUsed = useMemo(() => {
    const userSlots = resolvedEquipment.reduce((sum, item) => sum + item.slots, 0)
    const grantSlots = resolvedGranted.reduce((sum, item) => sum + item.slots, 0)
    return userSlots + grantSlots
  }, [resolvedEquipment, resolvedGranted])

  const totalSlots = PILOT_DEFAULTS.inventorySlots
  const emptySlots = Math.max(0, totalSlots - slotsUsed)

  // Filter picker to exclude already-equipped items
  const equippedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { ref } of resolvedEquipment) ids.add(ref.schema_ref_id)
    for (const entity of grantedEquipment) ids.add(entity.id)
    return ids
  }, [resolvedEquipment, grantedEquipment])

  const pickerFilter = useCallback(
    (entity: { id: string }) => !equippedIds.has(entity.id),
    [equippedIds]
  )

  const handleAddSelect = useCallback(
    (entityId: string) => {
      onAdd?.(entityId)
      setPickerOpen(false)
    },
    [onAdd]
  )

  if (equipmentRefs.length === 0 && grantedEquipment.length === 0) return null

  const gap = compact ? 'gap-1.5' : 'gap-2'
  const mt = compact ? 'mt-1.5' : 'mt-2'

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        <SectionSeparator
          label="Equipment"
          value={`${slotsUsed}/${totalSlots}`}
          compact={compact}
        />
        <div className={`${mt} grid grid-cols-2 ${gap}`}>
          {/* Granted equipment (no controls — can't remove ability-granted items) */}
          {resolvedGranted.map(({ entity, slots }) => (
            <div key={`granted-${entity.id}`} className={slots >= 2 ? 'col-span-2' : ''}>
              <ReferenceEntityListingItem entity={entity} showDetailButton />
            </div>
          ))}

          {/* User-added equipment (with remove + condition controls) */}
          {resolvedEquipment.map(({ ref, entity, slots }) => {
            if (!entity) return null
            const condition = ref.condition as ItemCondition | null
            const controls = []
            if (canEdit && onRemove) {
              controls.push(deleteControl(() => onRemove(ref.id)))
            }
            if (condition && onConditionChange) {
              controls.push(
                makeConditionControl(condition, (c) => onConditionChange(ref.id, c), !canEdit)
              )
            }
            return (
              <div key={ref.id} className={slots >= 2 ? 'col-span-2' : ''}>
                <ReferenceEntityListingItem
                  entity={entity}
                  disabled={condition === 'destroyed'}
                  damaged={condition != null && condition !== 'intact'}
                  showDetailButton
                  controls={controls.length > 0 ? controls : undefined}
                />
              </div>
            )
          })}

          {/* Empty slots — clickable to add equipment */}
          {Array.from({ length: emptySlots }, (_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              disabled={!canEdit || !onAdd}
              onClick={() => canEdit && onAdd && setPickerOpen(true)}
              className="flex h-9 cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-su-grey-light transition-colors hover:border-su-orange hover:bg-su-orange/5 disabled:cursor-default disabled:hover:border-su-grey-light disabled:hover:bg-transparent"
            >
              {canEdit && onAdd ? (
                <>
                  <Plus className="h-3 w-3 text-su-grey-dark" />
                  <span className="font-mono text-xs text-su-grey-dark">Add</span>
                </>
              ) : (
                <span className="font-mono text-xs text-su-grey-light">Empty</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {onAdd && (
        <ReferenceEntityPickerModal
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Add Equipment"
          subtitle="Select equipment to add"
          entities={allEquipment}
          onSelect={handleAddSelect}
          remainingSlots={emptySlots}
          filter={pickerFilter}
          closeOnSelect
        />
      )}
    </div>
  )
}
