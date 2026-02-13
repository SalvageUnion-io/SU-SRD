import type { SURefEntity, SURefMetaAction } from 'salvageunion-reference'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityChassisAbilitiesContentProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  chassisAbilities?: SURefMetaAction[]
}

export function EntityChassisAbilitiesContent({
  data,
  spacing,
  compact,
  chassisAbilities,
}: EntityChassisAbilitiesContentProps) {
  if (!chassisAbilities || chassisAbilities.length === 0) return null

  // Get chassis name from data
  const chassisName = 'name' in data ? data.name : undefined

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
