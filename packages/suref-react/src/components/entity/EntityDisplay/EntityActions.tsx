import type { SURefMetaAction } from 'salvageunion-reference'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

type EntityActionsProps = {
  spacing: ReturnType<typeof getEntitySpacing>
  compact: boolean
  actionsToDisplay?: SURefMetaAction[]
  headerBg: string
  /** When true, suppresses action rendering (e.g. chassis uses chassisAbilities instead) */
  suppressActions?: boolean
  /** When true, renders action titles as SectionSeparators instead of pseudoheaders */
  sectionHeaders?: boolean
}

export function EntityActions({
  spacing,
  compact,
  actionsToDisplay,
  headerBg,
  suppressActions,
  sectionHeaders = false,
}: EntityActionsProps) {
  if (suppressActions) return null

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
            sectionHeader={sectionHeaders}
          />
        )
      })}
    </div>
  )
}
