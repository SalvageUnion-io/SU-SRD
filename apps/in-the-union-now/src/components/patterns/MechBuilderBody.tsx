import type { ReactNode } from 'react'
import {
  SectionSeparator,
  ReferenceEntityChassisAbilitiesContent,
  getReferenceEntitySpacing,
  deleteControl,
} from 'suref-react'
import type { SURefChassis, SURefMetaAction } from 'salvageunion-reference'
import type { ResolvedItem, CapacityInfo } from '../../lib/builderUtils'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'
import { EmptySlotCard } from './EmptySlotCard'

type MechBuilderBodyProps = {
  chassis: SURefChassis | undefined
  chassisAbilities: SURefMetaAction[] | undefined
  systemItems: ResolvedItem[]
  moduleItems: ResolvedItem[]
  capacity: CapacityInfo
  readOnly?: boolean
  compact?: boolean
  pilotContent?: ReactNode
  onRemoveItem: (sortOrder: number) => void
  onAddItem: (target: BuilderSchemaName) => void
}

export function MechBuilderBody({
  chassis,
  chassisAbilities,
  systemItems,
  moduleItems,
  capacity,
  readOnly,
  compact,
  pilotContent,
  onRemoveItem,
  onAddItem,
}: MechBuilderBodyProps) {
  return (
    <div className={compact ? 'px-2 pt-2 pb-2' : 'px-4 pt-3 pb-4'}>
      {/* Pilot listing */}
      {pilotContent && (
        <div className="-mt-2 mb-4">
          <SectionSeparator label="Pilot" compact={compact} />
          <div className={compact ? 'mt-1.5' : 'mt-2'}>{pilotContent}</div>
        </div>
      )}

      {/* Chassis Abilities */}
      {chassis && chassisAbilities && chassisAbilities.length > 0 && (
        <div className={pilotContent ? 'mb-4' : '-mt-4 mb-4 overflow-hidden'}>
          <ReferenceEntityChassisAbilitiesContent
            chassisName={chassis.name}
            spacing={getReferenceEntitySpacing(!!compact)}
            compact={!!compact}
            chassisAbilities={chassisAbilities}
          />
        </div>
      )}

      <ItemSlotSection
        label="Systems"
        items={systemItems}
        slotsUsed={capacity.systemSlotsUsed}
        slotsTotal={capacity.systemSlotsTotal}
        slotType="systems"
        readOnly={readOnly}
        hasChassis={!!chassis}
        onRemove={onRemoveItem}
        onAdd={onAddItem}
        compact={compact}
        className="mb-4"
      />

      <ItemSlotSection
        label="Modules"
        items={moduleItems}
        slotsUsed={capacity.moduleSlotsUsed}
        slotsTotal={capacity.moduleSlotsTotal}
        slotType="modules"
        readOnly={readOnly}
        hasChassis={!!chassis}
        onRemove={onRemoveItem}
        onAdd={onAddItem}
        compact={compact}
        className="mb-2"
      />

      {/* Clear float */}
      <div className="clear-both" />
    </div>
  )
}

function ItemSlotSection({
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
}: {
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
}) {
  const addLabel = slotType === 'systems' ? 'Add System' : 'Add Module'

  return (
    <section className={className}>
      <SectionSeparator label={`${label} (${slotsUsed}/${slotsTotal})`} compact={compact} />
      <div className={compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}>
        {items.map((item) => (
          <ReferenceEntityListingItem
            key={item.sort_order}
            entity={item.entity}
            controls={readOnly ? undefined : [deleteControl(() => onRemove(item.sort_order))]}
          />
        ))}
        {!readOnly && hasChassis && slotsUsed < slotsTotal && (
          <EmptySlotCard label={addLabel} onClick={() => onAdd(slotType)} />
        )}
      </div>
    </section>
  )
}
