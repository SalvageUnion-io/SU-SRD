import type { SURefMetaAction, SURefObjectTable } from 'salvageunion-reference'
import {
  getReferenceEntityName,
  getRequiredTraits,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { BlockContentRendererView } from './BlockContentRendererView'
import { extractReferenceEntityDetails } from '../../lib/referenceEntityDataExtraction'
import { DataValueDisplayView } from './DataValueDisplayView'
import { RollTable } from '../shared/RollTable'
import { borderColorFromHeaderBg } from './referenceEntityHelpers'
import { SectionSeparator } from './ReferenceEntityDisplay/SectionSeparator'
import { ActionCard } from './ActionCard'
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
  /**
   * When true, renders title as a SectionSeparator instead of an action card.
   * When false (default), renders the new ActionCard entity-card treatment.
   */
  sectionHeader?: boolean
}

/**
 * NestedActionDisplay — renders sub-actions in one of two modes:
 *
 * - sectionHeader=true (legacy/crawler path): title as SectionSeparator + left-border
 *   content block. Kept for backward compat with callers that pass sectionHeaders.
 * - sectionHeader=false (default): delegates to ActionCard for the new entity-card
 *   treatment. This is the standard path for bio-titans, NPCs, creatures, squads, etc.
 */
export function NestedActionDisplay({
  data,
  compact = false,
  hideContent = false,
  headerBg,
  sectionHeader = false,
}: NestedActionDisplayProps) {
  // New path: render as an entity card.
  if (!sectionHeader) {
    return (
      <ActionCard
        data={data}
        compact={compact}
        hideContent={hideContent}
        parentHeaderBg={headerBg}
      />
    )
  }

  // Legacy path: SectionSeparator title + left-border content block.
  // Regular actions use AP currency
  const details = extractReferenceEntityDetails(data, undefined, 'AP')

  // Match ReferenceEntityDisplay fontSize.sm: compact ? 'xs' : 'sm'
  const fontSize = compact ? 'text-xs' : 'text-sm'
  const verticalSpacing = compact ? 'py-1 gap-1' : 'py-2 gap-2'
  const hasContent = data.content && data.content.length > 0
  // Resolve table: direct property first, then look up roll table by action name
  const resolvedTable: SURefObjectTable | undefined = (() => {
    if (data.table !== undefined && data.table !== null) return data.table
    const rollTable = SalvageUnionReference.RollTables.find((rt) => rt.name === data.name)
    return rollTable?.table
  })()
  const hasTable = resolvedTable !== undefined

  const hasContentToRender = hasContent && !hideContent
  const requiredTraits = getRequiredTraits(data)

  const displayName = getReferenceEntityName(data) || data.name

  const borderColor = borderColorFromHeaderBg(headerBg)

  return (
    <div className="overflow-hidden bg-transparent">
      <div className={verticalSpacing}>
        <SectionSeparator label={displayName} compact={compact} />
      </div>

      {/* Bordered section: text content only */}
      {(details.length > 0 || requiredTraits.length > 0 || hasContentToRender) && (
        <div
          className={cn(compact ? 'pl-2' : 'pl-3', hasTable && (compact ? 'mb-1' : 'mb-2'))}
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
                <DataValueDisplayView key={index} item={item} compact={compact} />
              ))}
            </div>
          )}

          {requiredTraits.length > 0 && (
            <p className={cn('italic text-gray-500', fontSize, compact ? 'py-0.5' : 'py-1')}>
              Requires the{' '}
              <strong className="font-semibold uppercase">
                {requiredTraits.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
              </strong>{' '}
              Trait.
            </p>
          )}

          {hasContentToRender && (
            <div
              className={cn(
                'flex flex-col items-stretch',
                compact ? 'gap-1' : 'gap-2',
                compact ? 'py-1' : 'py-2',
                details.length > 0 || requiredTraits.length > 0 ? 'pt-0' : ''
              )}
            >
              <BlockContentRendererView
                content={data.content!}
                fontSize={fontSize}
                compact={compact}
              />
            </div>
          )}
        </div>
      )}

      {/* Roll table: outside the border */}
      {hasTable && (
        <div className="relative z-10 rounded-md">
          <RollTable
            disabled={false}
            table={resolvedTable!}
            showCommand
            compact
            tableName={displayName}
          />
        </div>
      )}
    </div>
  )
}
