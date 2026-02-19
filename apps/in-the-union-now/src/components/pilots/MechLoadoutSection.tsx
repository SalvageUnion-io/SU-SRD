import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, ItemCondition, SURefEntity } from 'salvageunion-reference'
import { makeConditionControl } from '../shared/ConditionToggle'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { ReferenceEntityRefSection } from '../shared/ReferenceEntityRefSection'
import type { EntityRefRow } from '../../types/common'

type MechLoadoutSectionProps = {
  mechRefs: EntityRefRow[]
  compact?: boolean
  canEdit: boolean
  onConditionChange: (refId: string, condition: ItemCondition) => void
}

export function MechLoadoutSection({
  mechRefs,
  compact,
  canEdit,
  onConditionChange,
}: MechLoadoutSectionProps) {
  const systemRefs = useMemo(() => mechRefs.filter((r) => r.schema_name === 'systems'), [mechRefs])
  const moduleRefs = useMemo(() => mechRefs.filter((r) => r.schema_name === 'modules'), [mechRefs])

  if (systemRefs.length === 0 && moduleRefs.length === 0) return null

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {systemRefs.length > 0 && (
        <ReferenceEntityRefSection label="Systems" compact={compact}>
          {systemRefs.map((ref) => {
            const entity = SalvageUnionReference.get(
              ref.schema_name as EntitySchemaName,
              ref.schema_ref_id
            ) as SURefEntity | undefined
            if (!entity) return null
            const condition = ref.condition as ItemCondition
            return (
              <ReferenceEntityListingItem
                key={ref.id}
                entity={entity}
                disabled={condition === 'destroyed'}
                damaged={condition !== 'intact'}
                controls={[
                  makeConditionControl(condition, (c) => onConditionChange(ref.id, c), !canEdit),
                ]}
              />
            )
          })}
        </ReferenceEntityRefSection>
      )}
      {moduleRefs.length > 0 && (
        <ReferenceEntityRefSection label="Modules" compact={compact}>
          {moduleRefs.map((ref) => {
            const entity = SalvageUnionReference.get(
              ref.schema_name as EntitySchemaName,
              ref.schema_ref_id
            ) as SURefEntity | undefined
            if (!entity) return null
            const condition = ref.condition as ItemCondition
            return (
              <ReferenceEntityListingItem
                key={ref.id}
                entity={entity}
                disabled={condition === 'destroyed'}
                damaged={condition !== 'intact'}
                controls={[
                  makeConditionControl(condition, (c) => onConditionChange(ref.id, c), !canEdit),
                ]}
              />
            )
          })}
        </ReferenceEntityRefSection>
      )}
    </div>
  )
}
