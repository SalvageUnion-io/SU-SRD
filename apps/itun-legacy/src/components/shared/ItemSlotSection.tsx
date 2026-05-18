import { SectionSeparator, deleteControl } from 'suref-react'
import type { ReferenceEntityControl } from 'suref-react'
import type { ItemCondition } from 'salvageunion-reference'
import { Plus } from 'lucide-react'
import type { ResolvedItem } from '../../lib/builderUtils'
import type { BuilderSchemaName } from '../patterns/ReferenceEntitySelectionModal'
import type { EntityRefRow } from '../../types/common'
import { makeConditionControl } from './ConditionToggle'
import { ReferenceEntityListingItem } from './ReferenceEntityListingItem'

type ItemSlotSectionProps = {
  label: string
  items: ResolvedItem[]
  slotsUsed: number
  slotsTotal: number
  slotType: 'systems' | 'modules'
  readOnly?: boolean
  hasChassis: boolean
  onRemove: (sortOrder: number) => void
  onAdd: (target: BuilderSchemaName) => void
  compact?: boolean
  className?: string
  showDetailButton?: boolean
  entityRefs?: EntityRefRow[]
  onConditionChange?: (refId: string, condition: ItemCondition) => void
}

export function ItemSlotSection({
  label,
  items,
  slotsUsed,
  slotsTotal,
  slotType,
  readOnly,
  hasChassis,
  onRemove,
  onAdd,
  compact,
  className,
  showDetailButton,
  entityRefs,
  onConditionChange,
}: ItemSlotSectionProps) {
  const canAdd = !readOnly && hasChassis && slotsUsed < slotsTotal

  return (
    <section className={className}>
      <SectionSeparator label={label} value={`${slotsUsed}/${slotsTotal}`} compact={compact}>
        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd(slotType)}
            className="flex cursor-pointer items-center gap-0.5 font-mono text-xs font-bold uppercase text-su-grey-dark transition-colors hover:text-su-black"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </SectionSeparator>
      <div className={compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}>
        {items.map((item) => {
          // Match entity ref for condition tracking
          const matchedRef = entityRefs?.find(
            (r) =>
              r.schema_name === slotType &&
              r.schema_ref_id === item.entity.id &&
              r.sort_order === item.sort_order
          )
          const condition = (matchedRef?.condition as ItemCondition | null) ?? null

          const controls: ReferenceEntityControl[] = []
          if (!readOnly) {
            controls.push(deleteControl(() => onRemove(item.sort_order)))
          }
          if (condition && onConditionChange && matchedRef) {
            controls.push(
              makeConditionControl(condition, (c) => onConditionChange(matchedRef.id, c))
            )
          }

          return (
            <ReferenceEntityListingItem
              key={item.sort_order}
              entity={item.entity}
              controls={controls.length > 0 ? controls : undefined}
              disabled={condition === 'destroyed'}
              damaged={condition != null && condition !== 'intact'}
              showDetailButton={showDetailButton}
            />
          )
        })}
      </div>
    </section>
  )
}
