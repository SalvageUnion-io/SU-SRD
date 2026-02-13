import type { SURefMetaAction } from 'salvageunion-reference'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityChassisAbilitiesContentProps = {
  chassisName?: string
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  chassisAbilities?: SURefMetaAction[]
}

export function EntityChassisAbilitiesContent({
  chassisName,
  spacing,
  compact,
  chassisAbilities,
}: EntityChassisAbilitiesContentProps) {
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
          />
        )
      })}
    </div>
  )
}
