import type { SURefMetaAction } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { ReferenceEntityDisplay } from './index'
import { SectionSeparator } from './SectionSeparator'
import { PatternEquipmentItem } from './PatternEquipmentItem'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'
import { useDisplaySpacing } from './displayStateContext'

type ReferenceEntityChassisAbilitiesContentProps = {
  chassisName?: string
  /** Optional override; falls back to the card display-state context. */
  spacing?: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  chassisAbilities?: SURefMetaAction[]
  /** Drone equipment from pattern (pre-baked mode only) */
  droneEquipment?: Array<{ name?: string; systems: string[]; modules: string[] }>
  /** When true, skip rendering the drone entity (consumer renders it separately) */
  hideDrone?: boolean
}

export function ReferenceEntityChassisAbilitiesContent({
  chassisName,
  spacing: spacingProp,
  compact,
  chassisAbilities,
  droneEquipment,
  hideDrone,
}: ReferenceEntityChassisAbilitiesContentProps) {
  const spacing = useDisplaySpacing(spacingProp, compact)
  if (!chassisAbilities || chassisAbilities.length === 0) return null

  const droneAbility = chassisAbilities.find((a) => a.drone)
  const droneEntity = droneAbility?.drone
    ? SalvageUnionReference.findIn('drones', (d) => d.name === droneAbility.drone)
    : undefined

  const resolvedSystems = droneEquipment?.length
    ? droneEquipment.flatMap((drone) =>
        drone.systems.flatMap((name) => {
          const found = SalvageUnionReference.findIn('systems', (s) => s.name === name)
          return found ? [found] : []
        })
      )
    : []

  const resolvedModules = droneEquipment?.length
    ? droneEquipment.flatMap((drone) =>
        drone.modules.flatMap((name) => {
          const found = SalvageUnionReference.findIn('modules', (m) => m.name === name)
          return found ? [found] : []
        })
      )
    : []

  return (
    <div className={cn('mt-4', spacing.smallSpaceYClass)}>
      {chassisAbilities.map((ability) => (
        <NestedChassisAbility
          compact={compact}
          key={ability.id}
          data={ability}
          chassisName={chassisName}
        />
      ))}
      {droneEntity && !hideDrone && (
        <ReferenceEntityDisplay data={droneEntity} compact hide={{ actions: true, patterns: true }}>
          {(resolvedSystems.length > 0 || resolvedModules.length > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {resolvedSystems.length > 0 && (
                <div className={spacing.smallSpaceYClass}>
                  <SectionSeparator label="Systems" fontSize="text-xs" />
                  {resolvedSystems.map((entity, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static pattern list; index disambiguates duplicate system ids
                    <PatternEquipmentItem key={`drone-sys-${entity.id}-${idx}`} data={entity} />
                  ))}
                </div>
              )}
              {resolvedModules.length > 0 && (
                <div className={spacing.smallSpaceYClass}>
                  <SectionSeparator label="Modules" fontSize="text-xs" />
                  {resolvedModules.map((entity, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static pattern list; index disambiguates duplicate module ids
                    <PatternEquipmentItem key={`drone-mod-${entity.id}-${idx}`} data={entity} />
                  ))}
                </div>
              )}
            </div>
          )}
        </ReferenceEntityDisplay>
      )}
    </div>
  )
}
