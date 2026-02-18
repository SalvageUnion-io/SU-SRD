import { useMemo } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EntitySchemaName, ItemCondition, SURefEntity } from 'salvageunion-reference'
import { ConditionToggle } from '../shared/ConditionToggle'
import { EntityListingItem } from '../shared/EntityListingItem'
import { EntityRefSection } from '../shared/EntityRefSection'
import type { EntityRefRow } from '../../types/common'

type PilotEntityRefsProps = {
  refs: EntityRefRow[]
  canEdit?: boolean
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function PilotEntityRefs({ refs, canEdit, onConditionChange }: PilotEntityRefsProps) {
  const abilityRefs = useMemo(() => refs.filter((r) => r.schema_name === 'abilities'), [refs])
  const equipmentRefs = useMemo(() => refs.filter((r) => r.schema_name === 'equipment'), [refs])

  return (
    <div className="space-y-3">
      {abilityRefs.length > 0 && (
        <EntityRefSection label="Abilities">
          {abilityRefs.map((ref) => {
            const entity = SalvageUnionReference.get(
              ref.schema_name as EntitySchemaName,
              ref.schema_ref_id
            )
            if (!entity) return null
            return <EntityListingItem key={ref.id} entity={entity as SURefEntity} />
          })}
        </EntityRefSection>
      )}

      {equipmentRefs.length > 0 && (
        <EntityRefSection label="Equipment">
          {equipmentRefs.map((ref) => {
            const entity = SalvageUnionReference.get(
              ref.schema_name as EntitySchemaName,
              ref.schema_ref_id
            )
            if (!entity) return null
            return (
              <EntityListingItem
                key={ref.id}
                entity={entity as SURefEntity}
                trailing={
                  ref.condition && onConditionChange ? (
                    <ConditionToggle
                      condition={ref.condition as ItemCondition}
                      onChange={(c) => onConditionChange(ref.id, c)}
                      disabled={!canEdit}
                    />
                  ) : undefined
                }
              />
            )
          })}
        </EntityRefSection>
      )}
    </div>
  )
}
