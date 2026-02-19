import { SectionSeparator, deleteControl } from 'suref-react'
import { Plus } from 'lucide-react'
import type { ResolvedItem } from '../../lib/builderUtils'
import type { BuilderSchemaName } from '../patterns/ReferenceEntitySelectionModal'
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
}: ItemSlotSectionProps) {
  const canAdd = !readOnly && hasChassis && slotsUsed < slotsTotal

  return (
    <section className={className}>
      <SectionSeparator label={`${label} (${slotsUsed}/${slotsTotal})`} compact={compact}>
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
        {items.map((item) => (
          <ReferenceEntityListingItem
            key={item.sort_order}
            entity={item.entity}
            controls={readOnly ? undefined : [deleteControl(() => onRemove(item.sort_order))]}
            showDetailButton={showDetailButton}
          />
        ))}
      </div>
    </section>
  )
}
