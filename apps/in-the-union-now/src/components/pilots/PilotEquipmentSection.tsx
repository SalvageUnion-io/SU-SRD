import { useState, useMemo, useCallback } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, ItemCondition, SURefEntity } from 'salvageunion-reference'
import { ArrowLeftRight } from 'lucide-react'
import { makeConditionControl } from '../shared/ConditionToggle'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { ReferenceEntityRefSection } from '../shared/ReferenceEntityRefSection'
import { ReferenceEntityPickerModal } from '../shared/ReferenceEntityPickerModal'
import type { EntityRefRow } from '../../types/common'

type PilotEquipmentSectionProps = {
  refs: EntityRefRow[]
  compact?: boolean
  canEdit?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
  onSwap?: (refId: string, newSchemaRefId: string) => void
}

export function PilotEquipmentSection({
  refs,
  compact,
  canEdit,
  onConditionChange,
  onSwap,
}: PilotEquipmentSectionProps) {
  const [swappingRefId, setSwappingRefId] = useState<string | null>(null)
  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])

  const swappingRef = swappingRefId ? equipmentRefs.find((r) => r.id === swappingRefId) : undefined

  const allEquipment = useMemo(() => SalvageUnionReference.Equipment.all() as SURefEntity[], [])

  const handleSwapSelect = useCallback(
    (newId: string) => {
      if (!swappingRef || !onSwap) return
      if (newId === swappingRef.schema_ref_id) {
        setSwappingRefId(null)
        return
      }
      onSwap(swappingRef.id, newId)
      setSwappingRefId(null)
    },
    [swappingRef, onSwap]
  )

  if (equipmentRefs.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <ReferenceEntityRefSection label="Equipment" compact={compact} grid>
        {equipmentRefs.map((ref) => {
          const entity = SalvageUnionReference.get(
            ref.schema_name as EntitySchemaName,
            ref.schema_ref_id
          )
          if (!entity) return null
          const condition = ref.condition as ItemCondition | null
          const controls = []
          if (canEdit && onSwap) {
            controls.push({
              key: 'swap',
              icon: ArrowLeftRight,
              onClick: () => setSwappingRefId(ref.id),
              ariaLabel: 'Swap equipment',
              variant: 'ghost' as const,
            })
          }
          if (condition && onConditionChange) {
            controls.push(
              makeConditionControl(condition, (c) => onConditionChange(ref.id, c), !canEdit)
            )
          }
          return (
            <ReferenceEntityListingItem
              key={ref.id}
              entity={entity as SURefEntity}
              disabled={condition === 'destroyed'}
              damaged={condition != null && condition !== 'intact'}
              showDetailButton
              controls={controls.length > 0 ? controls : undefined}
            />
          )
        })}
      </ReferenceEntityRefSection>

      {onSwap && (
        <ReferenceEntityPickerModal
          open={swappingRefId !== null}
          onOpenChange={(open) => {
            if (!open) setSwappingRefId(null)
          }}
          title="Swap Equipment"
          subtitle="Select replacement equipment"
          entities={allEquipment}
          onSelect={handleSwapSelect}
          currentEntityId={swappingRef?.schema_ref_id}
          closeOnSelect
        />
      )}
    </div>
  )
}
