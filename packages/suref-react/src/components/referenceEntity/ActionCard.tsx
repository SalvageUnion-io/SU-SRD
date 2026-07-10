import type { ReactNode } from 'react'
import type { SURefMetaAction, SURefObjectTable } from 'salvageunion-reference'
import {
  getReferenceEntityName,
  getRequiredTraits,
  resolveActivationCurrency,
  SalvageUnionReference,
  parseContentBlockString,
} from 'salvageunion-reference'
import { DisplayCard } from '../shared/DisplayCard'
import { CardHeader } from '../shared/CardHeader'
import { BlockContentRendererView } from './BlockContentRendererView'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
import { accentDeepColor, accentTextColor, borderColorFromHeaderBg } from './referenceEntityHelpers'
import { extractReferenceEntityDetails } from '../../lib/referenceEntityDataExtraction'
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

  // The action type (e.g. "TURN ACTION") stays in the data-value row alongside
  // range/damage/traits — it is NOT lifted into a callout.
  // Currency follows the action's source: systems/modules cost EP, everything else AP.
  const details = extractReferenceEntityDetails(
    data,
    undefined,
    resolveActivationCurrency(data.actionSource)
  )

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

  const titanicContent = titanicMode ? data.content : undefined
  const firstBlock = titanicContent?.[0]
  if (titanicContent && firstBlock && firstBlock.type === 'paragraph') {
    const reminderText = parseContentBlockString(firstBlock)
    headerReminderContent = reminderText ? (
      <Text
        as="span"
        className={cn('text-right font-medium italic leading-snug', fontSize)}
        style={{ color: cardAccentText ?? 'white', maxWidth: '75%' }}
      >
        {reminderText}
      </Text>
    ) : null
    bodyContentBlocks = titanicContent.slice(1)
  }

  const hasBodyContent =
    (hasContentToRender && (!titanicMode || bodyContentBlocks.length > 0)) ||
    requiredTraits.length > 0 ||
    hasTable

  const dataTagsRow =
    details.length > 0 ? (
      <div className={cn('flex flex-row flex-wrap items-center', compact ? 'gap-0.5' : 'gap-1')}>
        {details.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: details are re-extracted per render from static reference data and never reordered
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
      compact={compact}
      borderColor={cardColor ?? 'var(--color-su-black)'}
      // Blank accent bar (matches the deep header colour) so the card closes with
      // a footer instead of a bare white edge — mirrors the entity-card footer.
      footerContent={<span aria-hidden className="block" />}
    >
      {hasBodyContent && (
        // Body accent field — the deep header colour shows through the mx-3 insets
        // around the white box, so the card's left/right edges match the header.
        <div className="w-full" style={cardColor ? { backgroundColor: cardColor } : undefined}>
          {/* Inset white body box — mirrors ReferenceEntityDisplayContent's body box.
              Left border uses the parent (lighter) accent so it stays visible
              against the deep accent field. */}
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

      {resolvedTable && (
        <div className="relative z-10 mx-3 mb-2 rounded-md">
          <RollTable
            disabled={false}
            table={resolvedTable}
            showCommand
            compact
            tableName={displayName}
          />
        </div>
      )}
    </DisplayCard>
  )
}
