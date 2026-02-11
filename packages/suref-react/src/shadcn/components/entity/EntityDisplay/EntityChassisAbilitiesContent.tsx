import { useEntityDisplayContext } from './useEntityDisplayContext'
import { NestedChassisAbility } from '../NestedChassisAbility'
import { cn } from '../../../utils/cn'

export function EntityChassisAbilitiesContent() {
  const { data, spacing, compact, chassisAbilities } = useEntityDisplayContext()

  if (!chassisAbilities || chassisAbilities.length === 0) return null

  // Get chassis name from data
  const chassisName = 'name' in data ? data.name : undefined

  return (
    <div
      className={cn('flex flex-col items-stretch', spacing.smallGap <= 1.5 ? 'gap-1.5' : 'gap-2')}
      style={{
        paddingLeft: `${spacing.contentPaddingX}rem`,
        paddingRight: `${spacing.contentPaddingX}rem`,
        paddingTop: `${spacing.contentPadding}rem`,
        paddingBottom: `${spacing.contentPadding}rem`,
      }}
    >
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
