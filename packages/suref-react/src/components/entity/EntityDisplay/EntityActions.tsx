import { useEntityDisplayContext } from './useEntityDisplayContext'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { cn } from '../../../utils/cn'

export function EntityActions() {
  const {
    schemaName,
    spacing,
    compact,
    hasActions: hasActionsValue,
    actionsToDisplay,
    headerBg,
  } = useEntityDisplayContext()

  // Chassis now use chassisAbilities instead of actions
  if (schemaName === 'chassis') return null

  if (!hasActionsValue) return null

  if (!actionsToDisplay || actionsToDisplay.length === 0) return null

  return (
    <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
      {actionsToDisplay.map((action) => {
        return (
          <NestedActionDisplay
            compact={compact}
            key={action.id}
            data={action}
            headerBg={headerBg}
          />
        )
      })}
    </div>
  )
}
