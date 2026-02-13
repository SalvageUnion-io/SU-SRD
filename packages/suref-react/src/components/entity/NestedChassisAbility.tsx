import type { SURefMetaAction, SURefObjectChoice } from 'salvageunion-reference'
import { getTable } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { EntityChoice } from './EntityDisplay/EntityChoice'
import type { DataValue } from '../../types/common'
import { extractEntityDetails } from '../../lib/entityDataExtraction'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
import { getEntityFontSizes, getEntitySpacing } from './EntityDisplay/entityDisplayTypes'
import { cn } from '../../utils/cn'

type NestedChassisAbilityProps = {
  /** Action data from salvageunion-reference */
  data: SURefMetaAction
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the action content */
  hideContent?: boolean
  /** Whether to hide the choices */
  hideChoices?: boolean
  /** Chassis name to replace [(CHASSIS)] placeholder with */
  chassisName?: string
}

/**
 * NestedChassisAbility - Renders chassis abilities with white background and black border
 *
 * Special rendering rules:
 * - Title renders as a pseudoheader (dark bg, white text)
 * - Data items (activation cost, keywords) render inline with title when there's no content or only one content block
 * - Content blocks always render below the title/details line
 */
export function NestedChassisAbility({
  data,
  compact = false,
  hideContent = false,
  hideChoices = false,
  chassisName,
}: NestedChassisAbilityProps) {
  // Chassis abilities use EP currency
  const details = extractEntityDetails(data, undefined, 'EP')

  const fontSize = compact ? 'text-xs' : 'text-sm'
  const titleFontSize = compact ? 'text-sm' : 'text-base'
  const hasContent = data.content && data.content.length > 0
  const actionChoices: SURefObjectChoice[] = data.choices || []
  const hasChoices = actionChoices.length > 0
  const resolvedTable = getTable(data)
  const hasTable = resolvedTable !== undefined

  // If there's a content block that's a datavalues type, extract those values
  let contentToRender: typeof data.content | undefined = data.content
  if (hasContent && data.content) {
    const datavaluesBlocks = data.content.filter(
      (block) => block.type === 'datavalues' && Array.isArray(block.value)
    )
    if (datavaluesBlocks.length > 0) {
      datavaluesBlocks.forEach((block) => {
        if (Array.isArray(block.value)) {
          const datavalues = block.value.map((item) => {
            if (item.type === 'cost') {
              const cost = String(item.label)
              const currency = item.value
              return { label: cost, value: currency, type: 'cost' } as DataValue
            }
            return {
              label: item.label,
              value: item.value,
              type: item.type,
            } as DataValue
          })
          details.push(...datavalues)
        }
      })
      contentToRender = data.content.filter(
        (block) => !(block.type === 'datavalues' && Array.isArray(block.value))
      ) as typeof data.content
      if (contentToRender.length === 0) {
        contentToRender = undefined
      }
    }
  }

  const remainingContent = contentToRender

  const hasBottomContent = details.length > 0 || remainingContent || hasTable || hasChoices

  return (
    <div
      className={cn(
        'overflow-visible border-2 border-su-black bg-white text-left',
        compact ? 'p-1' : 'p-2'
      )}
    >
      {/* Name and optional inline details */}
      <div
        className={cn(
          'flex flex-row flex-wrap items-center font-medium leading-relaxed text-su-black',
          fontSize,
          compact ? 'gap-0.5' : 'gap-1',
          hasBottomContent ? (compact ? 'mb-1' : 'mb-2') : 'mb-0'
        )}
      >
        <Text as="span" variant="pseudoheader" className={titleFontSize}>
          {data.name}
        </Text>
      </div>

      {/* Detail row below name (always compact) */}
      {details.length > 0 && (
        <div
          className={cn(
            'flex flex-row flex-wrap items-center gap-0.5',
            remainingContent || hasTable || hasChoices ? (compact ? 'mb-1' : 'mb-2') : 'mb-0'
          )}
        >
          {details.map((item, index) => (
            <DataValueDisplayView key={index} item={item} compact damaged={false} />
          ))}
        </div>
      )}

      {/* Remaining content blocks below detail row */}
      {remainingContent && remainingContent.length > 0 && !hideContent && (
        <div className={cn('flex flex-col items-stretch', compact ? 'gap-1' : 'gap-2')}>
          <BlockContentRendererView
            content={remainingContent}
            fontSize={fontSize}
            compact={compact}
            chassisName={chassisName}
            damaged={false}
          />
        </div>
      )}

      {/* Table */}
      {hasTable && (
        <div
          className={cn(
            'relative z-10 rounded-md',
            remainingContent && remainingContent.length > 0
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
            table={resolvedTable!}
            showCommand
            compact
            tableName={data.name}
          />
        </div>
      )}

      {/* Choices */}
      {hasChoices && !hideChoices && (
        <div
          className={cn(
            'flex flex-col items-stretch',
            compact ? 'gap-1' : 'gap-2',
            hasTable
              ? 'pt-0'
              : remainingContent && remainingContent.length > 0
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
              fontSize={getEntityFontSizes(compact)}
              spacing={getEntitySpacing(compact)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
