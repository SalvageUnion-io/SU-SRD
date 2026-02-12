import { useEntityDisplayContext } from './useEntityDisplayContext'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { cn } from '../../../utils/cn'

export function EntityChassisAbilitiesContent() {
  const { data, spacing, compact, chassisAbilities } = useEntityDisplayContext()

  if (!chassisAbilities || chassisAbilities.length === 0) return null

  // Get chassis name from data
  const chassisName = 'name' in data ? data.name : undefined

  return (
    <div className={cn(spacing.smallSpaceYClass)}>
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
