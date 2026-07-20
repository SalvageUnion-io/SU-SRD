import type { SURefObjectContentBlock, SURefObjectDataValue } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { parseContentBlockString } from 'salvageunion-reference'
import { Stat } from '../shared/Stat'
import { ActivationCost } from '../shared/ActivationCost'
import { borderColorFromHeaderBg } from './referenceEntityHelpers'
import { cn } from '../../utils/cn'
import { Slab } from '../chrome/Slab'
import { Badge } from '../chrome/Badge'

/**
 * A single `datavalues` item — rendered as a horizontal Stat chip (the one
 * canonical stat/value atom). A `cost` item ("3 AP") uses the ActivationCost
 * atom; a `trait`/`keyword` item gets its entity hover-tooltip; everything else
 * is a plain label|value cell (value + unit when present).
 */
function DataValueChip({ item, compact }: { item: SURefObjectDataValue; compact?: boolean }) {
  if (item.type === 'cost') {
    let cost: string | number = item.label
    let currency = item.value
    if (!currency && typeof item.label === 'string') {
      const parts = item.label.trim().split(/\s+/)
      const last = parts[parts.length - 1]
      if (last === 'AP' || last === 'EP' || last === 'XP') {
        cost = parts.slice(0, -1).join(' ')
        currency = last
      }
    }
    return <ActivationCost cost={cost} currency={currency} compact={compact} />
  }
  const value = item.value != null && item.unit ? `${item.value} ${item.unit}` : item.value
  const entityTooltip =
    item.type === 'trait'
      ? { schemaName: 'traits' as const, label: item.label }
      : item.type === 'keyword'
        ? { schemaName: 'keywords' as const, label: item.label }
        : undefined
  return (
    <Stat
      orientation="horizontal"
      label={item.label}
      value={value}
      compact={compact}
      inline={false}
      entityTooltip={entityTooltip}
    />
  )
}

type ContentProps = {
  /** The content blocks to render. */
  body: SURefObjectContentBlock[]
  /** Font size for content (Tailwind class) */
  fontSize?: string
  /** Whether to use compact styling */
  compact?: boolean
  /** Chassis name to replace [(CHASSIS)] placeholder with */
  chassisName?: string
  /** Header background class (e.g. 'bg-su-orange') for heading section left border */
  headerBg?: string
  /** Raw CSS color for borders (overrides headerBg-derived color when set) */
  headerBgColor?: string
}

/**
 * View-only component for rendering an array of content blocks
 * Handles different content block types:
 * - paragraph: Regular text with trait reference parsing
 * - heading: Semantic heading elements (h3-h5) with pseudoheader styling and level-based sizing
 * - list-item: Bulleted list item
 * - list-item-naked: List item without bullet
 * - label: Labeled content
 * - hint: Italic text for hints/tips
 * - datavalues: Array of data values rendered as compact flex row (value is array of dataValue objects)
 */
export function Content({
  body: rawContent,
  fontSize = 'text-sm',
  compact = false,
  chassisName,
  headerBg,
  headerBgColor,
}: ContentProps) {
  if (!rawContent || rawContent.length === 0) {
    return null
  }

  // `choice` blocks are position markers consumed by interleaving-aware renderers
  // (the NEW card's editable walk); they carry no display content, so strip them
  // here — read-only output is identical to data without them.
  const content = rawContent.filter((b) => b?.type !== 'choice')
  if (content.length === 0) {
    return null
  }

  // borderColor now only gates section grouping (below); the source-texture
  // treatment that once bordered each section — and the list-item frame — are gone.
  const borderColor = borderColorFromHeaderBg(headerBg, headerBgColor)

  // Section grouping (heading/datavalues blocks start a new section with top spacing)
  // is gated on borderColor: entities without a derived colour render the flat,
  // ungrouped block flow. Kept intentional to preserve current rendered spacing.
  const groupSections = Boolean(borderColor)

  // Group content blocks into sections: blocks before any heading/datavalues are ungrouped,
  // each heading or datavalues block starts a new section
  const sectionStarters = new Set(['heading', 'datavalues'])
  const sections: {
    startsSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  }[] = []
  let current: {
    startsSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  } = { startsSection: false, blocks: [] }

  for (let i = 0; i < content.length; i++) {
    const block = content[i]
    if (!block) continue
    if (block.type && sectionStarters.has(block.type) && groupSections) {
      // Push current section if it has blocks
      if (current.blocks.length > 0) {
        sections.push(current)
      }
      // Start a new section
      current = { startsSection: true, blocks: [{ block, originalIndex: i }] }
    } else {
      current.blocks.push({ block, originalIndex: i })
    }
  }
  if (current.blocks.length > 0) {
    sections.push(current)
  }

  return (
    <div>
      {sections.map((section) => {
        if (!section.startsSection) {
          return section.blocks.map(({ block, originalIndex }) => (
            <ContentBlock
              key={originalIndex}
              block={block}
              fontSize={fontSize}
              compact={compact}
              chassisName={chassisName}
            />
          ))
        }

        // Separate the leading heading or datavalues label from the bordered content
        const firstBlock = section.blocks[0]
        const isLeadingHeading = firstBlock?.block.type === 'heading'
        const hasDatavaluesLabel = firstBlock?.block.type === 'datavalues' && firstBlock.block.label
        const labelText = isLeadingHeading
          ? null
          : hasDatavaluesLabel
            ? firstBlock.block.label
            : null
        const headingBlock = isLeadingHeading ? firstBlock : null
        const contentBlocks = isLeadingHeading ? section.blocks.slice(1) : section.blocks

        return (
          <div key={`section-${firstBlock?.originalIndex ?? -1}`} className="mt-2">
            {headingBlock && (
              <ContentBlock
                block={headingBlock.block}
                fontSize={fontSize}
                compact={compact}
                chassisName={chassisName}
              />
            )}
            {labelText && (
              <Text variant="body" as="div" className={cn('mb-2', fontSize)}>
                {labelText}
              </Text>
            )}
            {contentBlocks.length > 0 && (
              <div>
                {contentBlocks.map(({ block, originalIndex }) => (
                  <ContentBlock
                    key={originalIndex}
                    block={block}
                    fontSize={fontSize}
                    compact={compact}
                    chassisName={chassisName}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ContentBlock({
  block,
  fontSize,
  compact,
  chassisName,
}: {
  block: SURefObjectContentBlock
  fontSize: string
  compact: boolean
  chassisName?: string
}) {
  const type = block.type || 'paragraph'
  const blockValue = block.value

  // Always parse the string value for the hook (even if we don't use it for datavalues)
  // This ensures React hooks are called in the same order every render
  const stringValue = parseContentBlockString(block, chassisName)
  const parsedValue = useParseTraitReferences(stringValue)

  // Handle datavalues type - value is an array of dataValue objects
  if (type === 'datavalues') {
    if (!Array.isArray(blockValue) || blockValue.length === 0) {
      return null
    }
    return (
      <div className="flex flex-row flex-wrap items-center gap-1">
        {blockValue.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: datavalues come from static reference content blocks and never reorder
          <DataValueChip key={index} item={item} compact={compact} />
        ))}
      </div>
    )
  }

  switch (type) {
    case 'paragraph':
      return (
        <Text
          variant="body"
          as="div"
          className={cn('mb-1', fontSize)}
          style={{ overflowWrap: 'break-word' }}
        >
          {parsedValue}
        </Text>
      )

    case 'heading': {
      // Section headings render as the canonical Slab separator — a level-1
      // heading takes the solid poster-stamp shape, sub-levels the dashed rule.
      const level = block.level || 3
      return <Slab variant={level === 1 ? 'solid' : 'dashed'} label={stringValue} />
    }

    case 'list-item': {
      // A plain hanging `- ` list item — no bordered frame. Labelled items (e.g.
      // NPC motivations) lead with a bold label; unlabelled bullets (e.g. "one of
      // the following" effect options) are just the dash + body. The flex + gap
      // gives a hanging indent so wrapped lines align under the text, not the dash.
      return (
        <div className={cn('mb-1 flex gap-2', fontSize)}>
          <span aria-hidden className="select-none">
            -
          </span>
          <Text
            variant="body"
            as="div"
            className={cn('flex-1', fontSize)}
            style={{ overflowWrap: 'break-word' }}
          >
            {block.label ? <span className="font-bold">{String(block.label)}: </span> : null}
            {parsedValue}
          </Text>
        </div>
      )
    }
    case 'hint':
      return (
        <Text variant="hint" as="div" className={fontSize} style={{ overflowWrap: 'break-word' }}>
          {parsedValue}
        </Text>
      )

    case 'flavor':
      return (
        <Text
          variant="flavor"
          as="div"
          className={cn('mb-1', fontSize)}
          style={{ overflowWrap: 'break-word' }}
        >
          {parsedValue}
        </Text>
      )

    case 'label':
      return (
        <div>
          {block.label && (
            <Badge shape="stamp" size="compact" className="mb-1 block">
              {block.label}
            </Badge>
          )}
          <Text variant="body" as="div" className={fontSize}>
            {parsedValue}
          </Text>
        </div>
      )

    default:
      // Fallback for unknown types — render as body prose.
      return (
        <Text variant="body" as="div" className={fontSize}>
          {parsedValue}
        </Text>
      )
  }
}
