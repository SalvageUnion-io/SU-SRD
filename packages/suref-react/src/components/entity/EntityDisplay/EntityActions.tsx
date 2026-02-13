import type { SURefEnumSchemaName, SURefMetaAction } from 'salvageunion-reference'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityActionsProps = {
  schemaName: SURefEnumSchemaName
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  hasActions: boolean
  actionsToDisplay?: SURefMetaAction[]
  headerBg: string
}

export function EntityActions({
  schemaName,
  spacing,
  compact,
  hasActions: hasActionsValue,
  actionsToDisplay,
  headerBg,
}: EntityActionsProps) {
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
