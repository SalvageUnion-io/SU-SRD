import type { SURefMetaAction, SURefObjectChoice } from 'salvageunion-reference'
import { getEntityDisplayName } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { EntityChoice } from './EntityDisplay/EntityChoice'
import { extractEntityDetails } from '../../lib/entityDataExtraction'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
import { borderColorFromHeaderBg } from './entityDisplayHelpers'
import { cn } from '../../utils/cn'

type NestedActionDisplayProps = {
  /** Action data from salvageunion-reference */
  data: SURefMetaAction
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the action content/description */
  hideContent?: boolean
  /** Header background class (e.g. 'bg-su-orange') for left border color */
  headerBg?: string
}

/**
 * NestedActionDisplay - Renders sub-actions in a visually subordinate style
 *
 * Used for rendering nested actions from entity.actions arrays.
 * Visually distinct from EntityDisplay with:
 * - Border to separate from main content
 * - Simpler, more compact layout
 * - Lower visual priority than full EntityDisplay
 */
export function NestedActionDisplay({
  data,
  compact = false,
  hideContent = false,
  headerBg,
}: NestedActionDisplayProps) {
  // Regular actions use AP currency
  const details = extractEntityDetails(data, undefined, 'AP')

  // Match EntityDisplay fontSize.sm: compact ? 'xs' : 'sm'
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const titleFontSize = compact ? 'text-sm' : 'text-xl'
  const verticalSpacing = compact ? 'py-1 gap-1' : 'py-2 gap-2'
  const hasContent = data.content && data.content.length > 0
  const actionChoices: SURefObjectChoice[] = data.choices || []
  const hasChoices = actionChoices.length > 0
  const hasTable = data.table !== undefined && data.table !== null

  const hasContentToRender = hasContent && !hideContent

  const displayName = getEntityDisplayName(data) || data.name

  const borderColor = borderColorFromHeaderBg(headerBg)

  return (
    <div className="overflow-hidden bg-transparent">
      <div className={cn('flex flex-wrap items-center bg-transparent', verticalSpacing)}>
        <Text
          variant="pseudoheader"
          className={cn('w-fit', titleFontSize, compact ? 'px-0.5 py-[1px]' : 'px-1 py-0.5')}
        >
          {displayName}
        </Text>
      </div>

      <div
        className={compact ? 'pl-2' : 'pl-3'}
        style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
      >
        {/* Detail row - always on new line for default variant */}
        {details.length > 0 && (
          <div
            className={cn(
              'flex flex-row flex-wrap items-center',
              compact ? 'gap-0.5' : 'gap-1',
              compact ? 'py-1 pt-0' : 'py-2 pt-0'
            )}
          >
            {details.map((item, index) => (
              <DataValueDisplayView key={index} item={item} compact={compact} damaged={false} />
            ))}
          </div>
        )}

        {hasContentToRender && (
          <div
            className={cn(
              'flex flex-col items-stretch',
              compact ? 'gap-1' : 'gap-2',
              compact ? 'py-1' : 'py-2',
              details.length > 0 ? 'pt-0' : ''
            )}
          >
            <BlockContentRendererView
              content={data.content!}
              fontSize={fontSize}
              compact={compact}
              damaged={false}
              headerBg={headerBg}
            />
          </div>
        )}

        {hasTable && (
          <div
            className={cn(
              'relative z-10 rounded-md',
              compact ? 'py-1' : 'py-2',
              hasContentToRender && !hideContent
                ? 'pt-0'
                : details.length > 0
                  ? 'pt-0'
                  : compact
                    ? 'pt-1'
                    : 'pt-2'
            )}
          >
            <RollTable
              disabled={false}
              table={data.table!}
              showCommand
              compact
              tableName={displayName}
            />
          </div>
        )}

        {hasChoices && (
          <div
            className={cn(
              'flex flex-col items-stretch',
              compact ? 'gap-1' : 'gap-2',
              compact ? 'py-1' : 'py-2',
              hasContentToRender && !hideContent
                ? 'pt-0'
                : hasTable
                  ? 'pt-0'
                  : details.length > 0
                    ? 'pt-0'
                    : compact
                      ? 'pt-1'
                      : 'pt-2'
            )}
          >
            {actionChoices.map((choice) => (
              <EntityChoice
                key={choice.id}
                choice={choice}
                userChoices={undefined}
                onChoiceSelection={undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
