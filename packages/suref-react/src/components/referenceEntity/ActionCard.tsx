import type { ReactNode } from 'react'
import type { SURefMetaAction, SURefObjectTable } from 'salvageunion-reference'
import {
  getReferenceEntityName,
  getRequiredTraits,
  SalvageUnionReference,
  parseContentBlockString,
} from 'salvageunion-reference'
import { DisplayCard } from '../shared/DisplayCard'
import { CardHeader } from '../shared/CardHeader'
import { BlockContentRendererView } from './BlockContentRendererView'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
import { accentDeepColor, accentTextColor, borderColorFromHeaderBg } from './referenceEntityHelpers'
import {
  extractReferenceEntityDetails,
  formatActionType,
} from '../../lib/referenceEntityDataExtraction'
import { Text } from '../base/Text'
import { cn } from '../../utils/cn'

type ActionCardProps = {
  /** Action data from salvageunion-reference */
  data: SURefMetaAction
  /** Whether to use compact styling */
  compact?: boolean
  /** Whether to hide the action content/description */
  hideContent?: boolean
  /**
   * Header background class of the PARENT entity (e.g. 'bg-su-rust').
   * The action card derives its own colour as the deep/darker variant of this.
   */
  parentHeaderBg?: string
  /**
   * Optional raw CSS color for the parent accent (overrides parentHeaderBg-derived color).
   */
  parentHeaderBgColor?: string
  /**
   * When true, the FIRST content paragraph is rendered in the card header's
   * right column (titanic action treatment) and excluded from the body.
   */
  titanicMode?: boolean
}

/**
 * ActionCard — renders a single action as a full entity-card.
 *
 * Used by ReferenceEntityActions to render each action as a proper DisplayCard
 * instead of the lighter left-border block from NestedActionDisplay.
 *
 * - Card color = deep/darker variant of the parent entity's accent colour.
 * - Callout label = the action TYPE ("TURN ACTION", "REACTION", etc.).
 *   The action-type keyword DataValue is filtered out of the data row to avoid
 *   duplication.
 * - Title = action display name.
 * - Data tags (subtitle row) = remaining DataValues (range, damage, traits, cost).
 * - Body = inset white box with 3px left border in the parent accent colour,
 *   containing BlockContentRendererView + optional RollTable + requiredTraits.
 */
export function ActionCard({
  data,
  compact = false,
  hideContent = false,
  parentHeaderBg,
  parentHeaderBgColor,
  titanicMode = false,
}: ActionCardProps) {
  // Derive card colour from the parent accent's deep (darker) tint.
  const cardColor = accentDeepColor(parentHeaderBg, parentHeaderBgColor)
  // Lighter tint for flavour/reminder text in the header right column.
  const cardAccentText = accentTextColor(parentHeaderBg, parentHeaderBgColor)
  // The body's left-border uses the parent accent directly (not deeper-of-deep).
  const bodyBorderColor = borderColorFromHeaderBg(parentHeaderBg, parentHeaderBgColor)

  const displayName = getReferenceEntityName(data) || data.name

  // Determine the action-type callout label.
  type DataWithActionType = { actionType?: string }
  const actionType = (data as DataWithActionType).actionType
  const actionTypeLabel = actionType ? formatActionType(actionType) : undefined

  // Extract all DataValues, then filter out the action-type keyword so it isn't
  // duplicated (it moves into the DisplayCard label callout).
  const allDetails = extractReferenceEntityDetails(data, undefined, 'AP')
  const details = actionTypeLabel
    ? allDetails.filter((item) => item.label !== actionTypeLabel)
    : allDetails

  const fontSize = compact ? 'text-xs' : 'text-sm'

  const hasContent = data.content && data.content.length > 0
  const hasContentToRender = hasContent && !hideContent

  // Resolve roll table: direct property first, then look up by action name.
  const resolvedTable: SURefObjectTable | undefined = (() => {
    if (data.table !== undefined && data.table !== null) return data.table
    const rollTable = SalvageUnionReference.RollTables.find((rt) => rt.name === data.name)
    return rollTable?.table
  })()
  const hasTable = resolvedTable !== undefined

  const requiredTraits = getRequiredTraits(data)

  // In titanic mode: the first paragraph goes to the header right column; the
  // remaining content blocks go in the body.
  let headerReminderContent: ReactNode = null
  let bodyContentBlocks = data.content ?? []

  if (titanicMode && hasContent && data.content!.length > 0) {
    const firstBlock = data.content![0]!
    if (firstBlock.type === 'paragraph') {
      const reminderText = parseContentBlockString(firstBlock)
      headerReminderContent = reminderText ? (
        <Text
          as="span"
          className={cn('text-right font-medium italic leading-snug', fontSize)}
          style={{ color: cardAccentText ?? 'white', maxWidth: '40%' }}
        >
          {reminderText}
        </Text>
      ) : null
      bodyContentBlocks = data.content!.slice(1)
    }
  }

  const hasBodyContent =
    (hasContentToRender && (!titanicMode || bodyContentBlocks.length > 0)) ||
    requiredTraits.length > 0 ||
    hasTable

  const dataTagsRow =
    details.length > 0 ? (
      <div className={cn('flex flex-row flex-wrap items-center', compact ? 'gap-0.5' : 'gap-1')}>
        {details.map((item, index) => (
          <DataValueDisplayView key={index} item={item} compact={compact} />
        ))}
      </div>
    ) : undefined

  const headerContent = (
    <CardHeader
      title={displayName || ''}
      subtitle={dataTagsRow}
      rightContent={titanicMode ? (headerReminderContent ?? undefined) : undefined}
      compact={compact}
    />
  )

  return (
    <DisplayCard
      // Pass the deep colour as headerBgColor (CSS value, not Tailwind class).
      // Leave headerBg empty so the card doesn't pick up Tailwind-class-based
      // border derivation (we override borderColor explicitly below).
      headerBg=""
      headerBgColor={cardColor}
      headerContent={headerContent}
      label={actionTypeLabel}
      compact={compact}
      borderColor={cardColor ?? 'var(--color-su-black)'}
    >
      {hasBodyContent && (
        <div
          className={cn('w-full', parentHeaderBg || 'bg-su-white')}
          style={parentHeaderBgColor ? { backgroundColor: parentHeaderBgColor } : undefined}
        >
          {/* Inset white body box — mirrors ReferenceEntityDisplayContent's body box.
              Left border uses the parent accent (not deeper-of-deep) to stay visible. */}
          <div
            className={cn('mx-3 min-w-0 bg-su-white p-0', bodyBorderColor && 'border-l-[3px]')}
            style={bodyBorderColor ? { borderLeftColor: bodyBorderColor } : undefined}
          >
            <div className={cn('flex flex-col gap-1', compact ? 'px-2 py-1' : 'px-3 py-2')}>
              {requiredTraits.length > 0 && (
                <p className={cn('italic text-gray-500', fontSize)}>
                  Requires the{' '}
                  <strong className="font-semibold uppercase">
                    {requiredTraits.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                  </strong>{' '}
                  Trait.
                </p>
              )}

              {hasContentToRender && bodyContentBlocks.length > 0 && (
                <BlockContentRendererView
                  content={bodyContentBlocks}
                  fontSize={fontSize}
                  compact={compact}
                  headerBg={parentHeaderBg}
                  headerBgColor={parentHeaderBgColor}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {hasTable && (
        <div className="relative z-10 mx-3 mb-2 rounded-md">
          <RollTable
            disabled={false}
            table={resolvedTable!}
            showCommand
            compact
            tableName={displayName}
          />
        </div>
      )}
    </DisplayCard>
  )
}
