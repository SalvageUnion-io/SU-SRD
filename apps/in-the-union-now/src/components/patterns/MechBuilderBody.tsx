import {
  SectionSeparator,
  CardImage,
  ReferenceEntityDisplay,
  ReferenceEntityChassisAbilitiesContent,
  getReferenceEntitySpacing,
} from 'suref-react'
import { RefreshCw } from 'lucide-react'
import type { SURefChassis, SURefMetaAction } from 'salvageunion-reference'
import type { ResolvedItem, CapacityInfo } from '../../lib/builderUtils'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { ItemSlotSection } from '../shared/ItemSlotSection'

type MechBuilderBodyProps = {
  chassis: SURefChassis | undefined
  chassisAbilities: SURefMetaAction[] | undefined
  systemItems: ResolvedItem[]
  moduleItems: ResolvedItem[]
  capacity: CapacityInfo
  readOnly?: boolean
  compact?: boolean
  onSelectChassis?: () => void
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
  onSelectChassis,
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
              <div className="space-y-4">
                {chassis && (
                  <div>
                    <SectionSeparator label="Chassis" compact={compact} />
                    <div className="mt-2">
                      <ReferenceEntityDisplay
                        data={chassis}
                        compact
                        listing
                        controls={
                          !readOnly && onSelectChassis
                            ? [
                                {
                                  key: 'change',
                                  icon: RefreshCw,
                                  onClick: onSelectChassis,
                                  ariaLabel: 'Change chassis',
                                  variant: 'ghost',
                                  label: 'Change',
                                },
                              ]
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )}
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
            </div>
          ) : (
            <div className="space-y-4">
              {chassis && (
                <div>
                  <SectionSeparator label="Chassis" compact={compact} />
                  <div className="mt-2">
                    <ReferenceEntityDisplay
                      data={chassis}
                      compact
                      listing
                      controls={
                        !readOnly && onSelectChassis
                          ? [
                              {
                                key: 'change',
                                icon: RefreshCw,
                                onClick: onSelectChassis,
                                ariaLabel: 'Change chassis',
                                variant: 'ghost',
                                label: 'Change',
                              },
                            ]
                          : undefined
                      }
                    />
                  </div>
                </div>
              )}
              {hasChassisAbilities && (
                <div>
                  <SectionSeparator label="Chassis Ability" compact={compact} />
                  <ReferenceEntityChassisAbilitiesContent
                    chassisName={chassis!.name}
                    spacing={getReferenceEntitySpacing(!!compact)}
                    compact={!!compact}
                    chassisAbilities={chassisAbilities!}
                  />
                </div>
              )}
            </div>
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
            showDetailButton
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
            showDetailButton
          />
        </div>
      )}
    </div>
  )
}
