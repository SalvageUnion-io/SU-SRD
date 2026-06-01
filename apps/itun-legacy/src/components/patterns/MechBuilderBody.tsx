import { useState, useMemo } from 'react'
import {
  SectionSeparator,
  CardImage,
  ReferenceEntityDisplay,
  ReferenceEntityChassisAbilitiesContent,
  getReferenceEntitySpacing,
  DualColumnLayout,
} from 'suref-react'
import { cn } from '../../lib/utils'
import type { SURefChassis, SURefMetaAction, ItemCondition } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { ResolvedItem, CapacityInfo } from '../../lib/builderUtils'
import type { BuilderSchemaName } from './ReferenceEntitySelectionModal'
import { ItemSlotSection } from '../shared/ItemSlotSection'
import { SubEntityCard } from '../shared/SubEntityCard'
import { MechCargoSection } from './MechCargoSection'
import type { EntityRefRow } from '../../types/common'

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
  mechId?: string
  mechRefs?: EntityRefRow[]
  userId?: string
  onConditionChange?: (refId: string, condition: ItemCondition) => void
  image?: {
    url?: string
    alt?: string
    editable?: {
      customUrl?: string | null
      onSetCustom: (url: string | null) => void
      onFileSelected?: (file: File) => void
      isUploading?: boolean
      removeLabel?: string
    }
  }
}

type MechTab = 'info' | 'systems' | 'drone' | 'cargo'

const TAB_LABELS: Record<MechTab, string> = {
  info: 'Info',
  systems: 'Systems & Modules',
  drone: 'Drone',
  cargo: 'Cargo',
}

// Match DisplayCard's color-mix pattern: 35% of the active color mixed with white
const ACTIVE_TAB_BG = 'color-mix(in srgb, rgb(122, 151, 138) 35%, white)'

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
  mechId,
  mechRefs,
  userId,
  onConditionChange,
  image,
}: MechBuilderBodyProps) {
  const [activeTab, setActiveTab] = useState<MechTab>('info')
  const hasChassisAbilities = !!(chassis && chassisAbilities && chassisAbilities.length > 0)

  // Resolve drone entity from chassis abilities
  const droneAbility = chassisAbilities?.find((a) => a.drone)
  const droneEntity = droneAbility?.drone
    ? SalvageUnionReference.findIn('drones', (d) => d.name === droneAbility.drone)
    : undefined
  const showDrone = !!droneEntity && !hideEquipment

  const visibleTabs = useMemo(() => {
    const tabs: MechTab[] = ['info', 'systems']
    if (showDrone) tabs.push('drone')
    tabs.push('cargo')
    return tabs
  }, [showDrone])

  return (
    <div>
      {/* Tab bar — matches DisplayCard tab styling */}
      <div className="flex" role="tablist">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cn(
                'flex-1 cursor-pointer py-1.5 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
                isActive ? 'text-su-black' : 'bg-su-white text-su-black hover:bg-su-grey-light'
              )}
              style={isActive ? { backgroundColor: ACTIVE_TAB_BG } : undefined}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className={compact ? 'p-3' : 'p-4'}>
        {activeTab === 'info' && (
          <>
            {(image || hasChassisAbilities) && (
              <div>
                {image ? (
                  <div className="md:grid md:grid-cols-[auto_1fr] md:items-center">
                    <CardImage
                      url={image.url}
                      alt={image.alt ?? `${chassis?.name ?? 'Mech'} illustration`}
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
                              headerBgColor={ACTIVE_TAB_BG}
                              controls={
                                !readOnly && onSelectChassis
                                  ? [
                                      {
                                        key: 'change',
                                        label: 'Change',
                                        onClick: onSelectChassis,
                                        ariaLabel: 'Change chassis',
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
                            hideDrone={showDrone}
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
                            headerBgColor={ACTIVE_TAB_BG}
                            controls={
                              !readOnly && onSelectChassis
                                ? [
                                    {
                                      key: 'change',
                                      label: 'Change',
                                      onClick: onSelectChassis,
                                      ariaLabel: 'Change chassis',
                                      variant: 'ghost',
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
                          hideDrone={showDrone}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'systems' && !hideEquipment && (
          <DualColumnLayout
            className="mb-2"
            left={
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
                entityRefs={mechRefs}
                onConditionChange={onConditionChange}
              />
            }
            right={
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
                entityRefs={mechRefs}
                onConditionChange={onConditionChange}
              />
            }
          />
        )}

        {activeTab === 'drone' && showDrone && (
          <SubEntityCard
            entity={droneEntity}
            mechId={mechId}
            mechRefs={mechRefs}
            userId={userId}
            readOnly={readOnly}
            compact
            hide={{ actions: true, patterns: true }}
          />
        )}

        {activeTab === 'cargo' && mechId && userId && (
          <MechCargoSection mechId={mechId} userId={userId} readOnly={readOnly} />
        )}
      </div>
    </div>
  )
}
