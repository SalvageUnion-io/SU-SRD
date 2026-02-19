import type { SURefMetaAction } from 'salvageunion-reference'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityChassisAbilitiesContentProps = {
  chassisName?: string
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  chassisAbilities?: SURefMetaAction[]
  /** Drone equipment from pattern (pre-baked mode only) */
  droneEquipment?: { systems: string[]; modules: string[] }
}

export function ReferenceEntityChassisAbilitiesContent({
  chassisName,
  spacing,
  compact,
  chassisAbilities,
  droneEquipment,
}: ReferenceEntityChassisAbilitiesContentProps) {
  if (!chassisAbilities || chassisAbilities.length === 0) return null

  return (
    <div className={cn('mt-4', spacing.smallSpaceYClass)}>
      {chassisAbilities.map((ability) => {
        return (
          <NestedChassisAbility
            compact={compact}
            key={ability.id}
            data={ability}
            chassisName={chassisName}
            droneEquipment={ability.drone ? droneEquipment : undefined}
          />
        )
      })}
    </div>
  )
}
