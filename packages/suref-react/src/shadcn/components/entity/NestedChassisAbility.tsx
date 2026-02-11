import type {
  SURefMetaAction,
  SURefObjectChoice,
  SURefObjectContentBlock,
} from 'salvageunion-reference'
import { Text } from '../base/Text'
import { BlockContentRendererView } from './BlockContentRendererView'
import { EntityChoice } from './EntityDisplay/EntityChoice'
import { InlineContentBlock } from './InlineContentBlock'
import type { DataValue } from '../../../shared/types/common'
import { extractEntityDetails } from '../../../shared/lib/entityDataExtraction'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
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
 * - Data items (activation cost, keywords) render inline with title when there's no content or only one content block
 * - When there are no data items, the first content block renders inline with the title
 * - Content blocks render below the title/details line
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
  const spacingValue = compact ? 1 : 2

  const hasContent = data.content && data.content.length > 0
  const actionChoices: SURefObjectChoice[] = data.choices || []
  const hasChoices = actionChoices.length > 0
  const hasTable = data.table !== undefined && data.table !== null

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

  const remainingContentBlockCount = contentToRender?.length ?? 0
  const hasDataItems = details.length > 0

  let firstContentBlock: SURefObjectContentBlock | null = null
  let remainingContent: typeof data.content | undefined = undefined
  let renderDetailsInline = false
  let renderFirstContentInline = false

  if (!hasDataItems && hasContent && contentToRender && contentToRender.length > 0) {
    renderFirstContentInline = true
    firstContentBlock = contentToRender[0] ?? null
    if (contentToRender.length > 1) {
      remainingContent = contentToRender.slice(1) as typeof data.content
    }
  } else if (hasDataItems && hasContent && contentToRender && contentToRender.length > 0) {
    if (remainingContentBlockCount > 1) {
      renderFirstContentInline = true
      firstContentBlock = contentToRender[0] ?? null
      remainingContent = contentToRender.slice(1) as typeof data.content
      renderDetailsInline = false
    } else {
      renderDetailsInline = true
      remainingContent = contentToRender
    }
  } else if (hasDataItems && !hasContent) {
    renderDetailsInline = true
  }

  const hasBottomContent =
    (details.length > 0 && !renderDetailsInline) || remainingContent || hasTable || hasChoices

  return (
    <div
      className={cn(
        'overflow-hidden border-2 border-su-black bg-white text-left',
        compact ? 'p-1' : 'p-2'
      )}
    >
      {/* Name, details, and/or first content block on same line - wraps inline */}
      <div
        className={cn(
          'flex flex-row flex-wrap items-center font-medium leading-relaxed text-su-black',
          fontSize,
          compact ? 'gap-0.5' : 'gap-1',
          hasBottomContent ? (compact ? 'mb-1' : 'mb-2') : 'mb-0'
        )}
      >
        <Text as="span" className={cn('font-bold', titleFontSize)}>
          {data.name}:
        </Text>
        {/* Render details inline with title if condition is met */}
        {renderDetailsInline &&
          details.length > 0 &&
          details.map((item, index) => (
            <DataValueDisplayView key={index} item={item} compact={compact} damaged={false} />
          ))}
        {/* Render first content block inline when condition is met */}
        {renderFirstContentInline && firstContentBlock && (
          <InlineContentBlock
            block={firstContentBlock}
            fontSize={fontSize}
            chassisName={chassisName}
          />
        )}
      </div>

      {/* Detail row below name (only if not rendered inline) */}
      {details.length > 0 && !renderDetailsInline && (
        <div
          className={cn(
            'flex flex-row flex-wrap items-center',
            compact ? 'gap-0.5' : 'gap-1',
            remainingContent || hasTable || hasChoices ? (compact ? 'mb-1' : 'mb-2') : 'mb-0'
          )}
        >
          {details.map((item, index) => (
            <DataValueDisplayView key={index} item={item} compact={compact} damaged={false} />
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
              : details.length > 0 && !renderDetailsInline
                ? 'pt-0'
                : `pt-${spacingValue}`
          )}
        >
          <RollTable
            disabled={false}
            table={data.table!}
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
                : details.length > 0 && !renderDetailsInline
                  ? 'pt-0'
                  : `pt-${spacingValue}`
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
  )
}
