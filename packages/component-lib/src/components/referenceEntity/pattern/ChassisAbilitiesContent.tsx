import type { SURefEntity, SURefMetaAction } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../card/ReferenceEntityCard'
import { entityHostTone } from '../card/entityCardTone'
import { SectionSeparator } from '../SectionSeparator'
import { PatternEquipmentItem } from './PatternEquipmentItem'
import { cn } from '../../../utils/cn'
import { getReferenceEntitySpacing } from '../referenceEntityTypes'

type ChassisAbilitiesContentProps = {
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

export function ChassisAbilitiesContent({
  chassisName,
  spacing: spacingProp,
  compact,
  chassisAbilities,
  droneEquipment,
  hideDrone,
}: ChassisAbilitiesContentProps) {
  const spacing = spacingProp ?? getReferenceEntitySpacing(compact)
  if (!chassisAbilities || chassisAbilities.length === 0) return null

  // The owning chassis's tone — ghosted onto each ability card as its host tone.
  const chassis = chassisName
    ? SalvageUnionReference.Chassis.find((c) => c.name === chassisName)
    : undefined
  const abilityHostTone = chassis ? entityHostTone(chassis) : undefined

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
        <ReferenceEntityCard
          size="medium"
          key={ability.id}
          data={ability as unknown as SURefEntity}
          chassisName={chassisName}
          hostTone={abilityHostTone}
        />
      ))}
      {droneEntity && !hideDrone && (
        <>
          <ReferenceEntityCard
            data={droneEntity}
            size="medium"
            hide={{ actions: true, patterns: true }}
          />
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
        </>
      )}
    </div>
  )
}
