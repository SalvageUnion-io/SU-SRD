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

          {/* Masonry via CSS multi-column: each card keeps its NATURAL height
              (a grid would stretch a card to its row-neighbour's height, leaving
              dead space between the body box and footer). The browser balances
              the two columns by default (column-fill: balance).
              @container on the wrapper; @md: fires when the container is ≥ 28rem,
              switching from 1 to 2 columns. `gap-3` is the column-gap; vertical
              spacing between stacked cards comes from `mb-3` on each wrapper.
              `break-inside-avoid` keeps a card from splitting across columns.
              NOTE: the consuming app / page must NOT have overflow:hidden on an
              ancestor that would prevent the container from reporting its width;
              if actions appear single-column, check ancestor overflow constraints.
              mt-2 gives a clear gap below the "Actions" separator label. */}
          <div className="@container mt-2">
            <div className="columns-1 gap-3 @md:columns-2">
              {/* Regular actions always render compact; the titanic action stays
                  full so its reminder + option list have room. */}
              {regularActions.map((action) => (
                <div key={action.id} className="mb-3 break-inside-avoid">
                  <ActionCard data={action} compact parentHeaderBg={headerBg} />
                </div>
              ))}

              {/* Titanic action spans all columns as the last item (full width). */}
              {titanicAction && (
                <div className="mb-3 break-inside-avoid [column-span:all]">
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
