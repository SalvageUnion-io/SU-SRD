import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, ItemCondition, SURefEntity } from 'salvageunion-reference'
import { makeConditionControl } from '../shared/ConditionToggle'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { ReferenceEntityRefSection } from '../shared/ReferenceEntityRefSection'
import type { EntityRefRow } from '../../types/common'

type PilotEquipmentSectionProps = {
  refs: EntityRefRow[]
  compact?: boolean
  canEdit?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function PilotEquipmentSection({
  refs,
  compact,
  canEdit,
  onConditionChange,
}: PilotEquipmentSectionProps) {
  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])

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
          return (
            <ReferenceEntityListingItem
              key={ref.id}
              entity={entity as SURefEntity}
              disabled={condition === 'destroyed'}
              damaged={condition != null && condition !== 'intact'}
              showDetailButton
              controls={
                condition && onConditionChange
                  ? [makeConditionControl(condition, (c) => onConditionChange(ref.id, c), !canEdit)]
                  : undefined
              }
            />
          )
        })}
      </ReferenceEntityRefSection>
    </div>
  )
}
