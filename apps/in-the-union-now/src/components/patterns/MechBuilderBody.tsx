import {
  SectionSeparator,
  CardImage,
  ReferenceEntityChassisAbilitiesContent,
  getReferenceEntitySpacing,
  deleteControl,
} from 'suref-react'
import { Plus } from 'lucide-react'
import type { SURefChassis, SURefMetaAction } from 'salvageunion-reference'
import type { ResolvedItem, CapacityInfo } from '../../lib/builderUtils'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { ReferenceEntityListingItem } from '../shared/ReferenceEntityListingItem'

type MechBuilderBodyProps = {
  chassis: SURefChassis | undefined
  chassisAbilities: SURefMetaAction[] | undefined
  systemItems: ResolvedItem[]
  moduleItems: ResolvedItem[]
  capacity: CapacityInfo
  readOnly?: boolean
  compact?: boolean
  onRemoveItem: (sortOrder: number) => void
  onAddItem: (target: BuilderSchemaName) => void
  hideEquipment?: boolean
  image?: {
    url?: string
    alt?: string
    editable?: {
      customUrl?: string | null
      onSetCustom: (url: string | null) => void
    }
  }
}

export function MechBuilderBody({
  chassis,
  chassisAbilities,
  systemItems,
  moduleItems,
  capacity,
  readOnly,
  compact,
  onRemoveItem,
  onAddItem,
  hideEquipment,
  image,
}: MechBuilderBodyProps) {
  const hasChassisAbilities = !!(chassis && chassisAbilities && chassisAbilities.length > 0)

  return (
    <div>
      {/* Image + Chassis Abilities (vertically centered grid) */}
      {(image || hasChassisAbilities) && (
        <div className={hideEquipment ? '' : 'mb-4'}>
          {image ? (
            <div className="md:grid md:grid-cols-[auto_1fr] md:items-center">
              <CardImage
                url={image.url}
                alt={image.alt}
                compact={compact}
                editable={image.editable}
              />
              {hasChassisAbilities && (
                <div>
                  <SectionSeparator label="Chassis Ability" compact={compact} />
                  <ReferenceEntityChassisAbilitiesContent
                    chassisName={chassis!.name}
                    spacing={getReferenceEntitySpacing(false)}
                    compact={false}
                    chassisAbilities={chassisAbilities!}
                  />
                </div>
              )}
            </div>
          ) : (
            hasChassisAbilities && (
              <>
                <SectionSeparator label="Chassis Ability" compact={compact} />
                <ReferenceEntityChassisAbilitiesContent
                  chassisName={chassis!.name}
                  spacing={getReferenceEntitySpacing(!!compact)}
                  compact={!!compact}
                  chassisAbilities={chassisAbilities!}
                />
              </>
            )
          )}
        </div>
      )}

      {!hideEquipment && (
        <div className="mb-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          />
        </div>
      )}
    </div>
  )
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
  showDetailButton?: boolean
}) {
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
