import type { SURefMetaAction } from 'salvageunion-reference'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityActionsProps = {
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  actionsToDisplay?: SURefMetaAction[]
  headerBg: string
  /** When true, suppresses action rendering (e.g. chassis uses chassisAbilities instead) */
  suppressActions?: boolean
  /** When true, renders action titles as SectionSeparators instead of pseudoheaders */
  sectionHeaders?: boolean
}

export function ReferenceEntityActions({
  spacing,
  compact,
  actionsToDisplay,
  headerBg,
  suppressActions,
  sectionHeaders = false,
}: ReferenceEntityActionsProps) {
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
