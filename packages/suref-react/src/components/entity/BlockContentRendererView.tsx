import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { parseContentBlockString } from '../../lib/contentBlockHelpers'
import { DataValueDisplayView } from './DataValueDisplayView'
import { cn } from '../../utils/cn'

type BlockContentRendererViewProps = {
  /** Content blocks to render */
  content: SURefObjectContentBlock[]
  /** Font size for content (Tailwind class) */
  fontSize?: string
  /** Whether to use compact styling */
  compact?: boolean
  /** Chassis name to replace [(CHASSIS)] placeholder with */
  chassisName?: string
  /** Whether the entity is damaged (affects visual styling) */
  damaged: boolean
  /** Header background class (e.g. 'bg-su-orange') for heading section left border */
  headerBg?: string
}

/**
 * View-only component for rendering an array of content blocks
 * Accepts damaged state as a required prop instead of reading from context
 *
 * Handles different content block types:
 * - paragraph: Regular text with trait reference parsing
 * - heading: Bold styled text (not true HTML headers) with level-based sizing
 * - list-item: Bulleted list item
 * - list-item-naked: List item without bullet
 * - label: Labeled content
 * - hint: Italic text for hints/tips
 * - datavalues: Array of data values rendered as compact flex row (value is array of dataValue objects)
 */
export function BlockContentRendererView({
  content,
  fontSize = 'text-sm',
  compact = false,
  chassisName,
  damaged,
  headerBg,
}: BlockContentRendererViewProps) {
  if (!content || content.length === 0) {
    return null
  }

  const borderColor = headerBg ? `var(--color-${headerBg.replace('bg-', '')})` : undefined

  // Group content blocks into sections: blocks before any heading/datavalues are ungrouped,
  // each heading or datavalues block starts a new bordered section
  const sectionStarters = new Set(['heading', 'datavalues'])
  const sections: {
    isBorderedSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  }[] = []
  let current: {
    isBorderedSection: boolean
    blocks: { block: SURefObjectContentBlock; originalIndex: number }[]
  } = { isBorderedSection: false, blocks: [] }

  for (let i = 0; i < content.length; i++) {
    const block = content[i]!
    if (block.type && sectionStarters.has(block.type) && borderColor) {
      // Push current section if it has blocks
      if (current.blocks.length > 0) {
        sections.push(current)
      }
      // Start a new bordered section
      current = { isBorderedSection: true, blocks: [{ block, originalIndex: i }] }
    } else {
      current.blocks.push({ block, originalIndex: i })
    }
  }
  if (current.blocks.length > 0) {
    sections.push(current)
  }

  return (
    <div>
      {sections.map((section, sIdx) => {
        if (!section.isBorderedSection) {
          return section.blocks.map(({ block, originalIndex }) => (
            <ContentBlock
              key={originalIndex}
              block={block}
              fontSize={fontSize}
              compact={compact}
              chassisName={chassisName}
              damaged={damaged}
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
          <div key={`section-${sIdx}`} className="mt-4">
            {headingBlock && (
              <ContentBlock
                block={headingBlock.block}
                fontSize={fontSize}
                compact={compact}
                chassisName={chassisName}
                damaged={damaged}
              />
            )}
            {labelText && (
              <div
                className={cn(
                  'mb-2 break-words font-medium leading-relaxed whitespace-normal text-su-black',
                  fontSize
                )}
              >
                {labelText}
              </div>
            )}
            {contentBlocks.length > 0 && (
              <div
                className={compact ? 'pl-2' : 'pl-3'}
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                {contentBlocks.map(({ block, originalIndex }) => (
                  <ContentBlock
                    key={originalIndex}
                    block={block}
                    fontSize={fontSize}
                    compact={compact}
                    chassisName={chassisName}
                    damaged={damaged}
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
  damaged,
}: {
  block: SURefObjectContentBlock
  fontSize: string
  compact: boolean
  chassisName?: string
  damaged: boolean
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
          <DataValueDisplayView key={index} item={item} compact={compact} damaged={damaged} />
        ))}
      </div>
    )
  }

  switch (type) {
    case 'paragraph':
      return (
        <div
          className={cn(
            'mb-2 break-words font-medium leading-relaxed whitespace-normal text-su-black',
            fontSize
          )}
          style={{ overflowWrap: 'break-word' }}
        >
          {parsedValue}
        </div>
      )

    case 'heading': {
      // Render as bold Text, not true HTML heading
      // Level 1: larger, Level 2: slightly smaller, Level 3: same as paragraph but bold
      const level = block.level || 3
      let headingFontSize: string
      if (level === 1) {
        headingFontSize = compact ? 'text-lg' : 'text-xl'
      } else if (level === 2) {
        headingFontSize = compact ? 'text-base' : 'text-lg'
      } else {
        // Level 3: same size as paragraph
        headingFontSize = fontSize
      }

      return (
        <Text
          as="span"
          className={cn('block font-bold leading-relaxed text-su-black', headingFontSize)}
        >
          {parsedValue}
        </Text>
      )
    }

    case 'list-item':
      return (
        <div className={cn('pl-2 font-medium leading-relaxed text-su-black', fontSize)}>
          <Text as="span" className="mr-1 font-bold">
            -
          </Text>
          {block.label && (
            <Text as="span" className="font-bold">
              {block.label}:
            </Text>
          )}
          {parsedValue}
        </div>
      )
    case 'hint':
      return (
        <div
          className={cn(
            'max-w-full overflow-hidden break-words font-normal italic leading-relaxed whitespace-normal text-su-black',
            fontSize
          )}
          style={{ overflowWrap: 'break-word' }}
        >
          {parsedValue}
        </div>
      )

    case 'label':
      return (
        <div>
          {block.label && (
            <Text variant="pseudoheader" className="mb-1 text-xs">
              {block.label}
            </Text>
          )}
          <div className={cn('font-medium leading-relaxed text-su-black', fontSize)}>
            {parsedValue}
          </div>
        </div>
      )

    default:
      // Fallback for unknown types - render as paragraph
      return (
        <div className={cn('font-medium leading-relaxed text-su-black', fontSize)}>
          {parsedValue}
        </div>
      )
  }
}
