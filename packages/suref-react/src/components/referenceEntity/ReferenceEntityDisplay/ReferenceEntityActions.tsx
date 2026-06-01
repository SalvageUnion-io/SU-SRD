import type { SURefMetaAction } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { ActionCard } from '../ActionCard'
import { SectionSeparator } from './SectionSeparator'
import { cn } from '../../../utils/cn'
import type { getReferenceEntitySpacing } from './referenceEntityDisplayTypes'

type ReferenceEntityActionsProps = {
  spacing: ReturnType<typeof getReferenceEntitySpacing>
  compact: boolean
  actionsToDisplay?: SURefMetaAction[]
  headerBg: string
  /** When true, suppresses action rendering (e.g. chassis uses chassisAbilities instead) */
  suppressActions?: boolean
  /** When true, renders action titles as SectionSeparators instead of action-cards */
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

  // sectionHeaders mode: legacy crawler/srd path — keep old NestedActionDisplay behaviour.
  if (sectionHeaders) {
    return (
      <div className={cn('rounded-md', spacing.smallSpaceYClass)}>
        {actionsToDisplay.map((action) => (
          <NestedActionDisplay
            compact={compact}
            key={action.id}
            data={action}
            headerBg={headerBg}
            sectionHeader
          />
        ))}
      </div>
    )
  }

  // Split into titanic (displayName === 'Titanic Actions') and regular actions.
  const titanicAction = actionsToDisplay.find(
    (a) => getReferenceEntityName(a) === 'Titanic Actions'
  )
  const regularActions = actionsToDisplay.filter(
    (a) => getReferenceEntityName(a) !== 'Titanic Actions'
  )

  return (
    <div className={cn('flex flex-col', spacing.smallSpaceYClass)}>
      {regularActions.length > 0 && (
        <>
          <SectionSeparator label="Actions" compact={compact} />

          {/* 2-column container query grid.
              @container on the wrapper; @md: breakpoint fires when the
              container itself is ≥ 28rem (448px), switching to 2 columns.
              Tailwind v4 has built-in container query support — no plugin needed.
              NOTE: the consuming app / page must NOT have overflow:hidden on an
              ancestor that would prevent the container from reporting its width;
              if actions appear single-column, check ancestor overflow constraints.
              mt-2 gives a clear gap below the "Actions" separator label. */}
          <div className="@container mt-2">
            <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
              {/* Regular actions always render compact; the titanic action stays
                  full so its reminder + option list have room. */}
              {regularActions.map((action) => (
                <ActionCard key={action.id} data={action} compact parentHeaderBg={headerBg} />
              ))}

              {/* Titanic action renders full-width as the last grid item */}
              {titanicAction && (
                <div className="col-span-full">
                  <ActionCard
                    key={titanicAction.id}
                    data={titanicAction}
                    compact={compact}
                    parentHeaderBg={headerBg}
                    titanicMode
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edge case: only a titanic action, no regular actions */}
      {regularActions.length === 0 && titanicAction && (
        <>
          <SectionSeparator label="Actions" compact={compact} />
          <div className="mt-2">
            <ActionCard
              data={titanicAction}
              compact={compact}
              parentHeaderBg={headerBg}
              titanicMode
            />
          </div>
        </>
      )}
    </div>
  )
}
