import { Box, Flex } from '@chakra-ui/react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { Text } from '../base/Text'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { parseContentBlockString } from 'suref-react'
import { DataValueDisplayView } from './DataValueDisplayView'

interface BlockContentRendererViewProps {
  /** Content blocks to render */
  content: SURefObjectContentBlock[]
  /** Font size for content */
  fontSize?: string
  /** Whether to use compact styling */
  compact?: boolean
  /** Chassis name to replace [(CHASSIS)] placeholder with */
  chassisName?: string
  /** Whether the entity is damaged (affects visual styling) */
  damaged: boolean
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
  fontSize = 'sm',
  compact = false,
  chassisName,
  damaged,
}: BlockContentRendererViewProps) {
  if (!content || content.length === 0) {
    return null
  }

  return (
    <Box mt={0}>
      {content.map((block, index) => (
        <ContentBlock
          key={index}
          block={block}
          fontSize={fontSize}
          compact={compact}
          chassisName={chassisName}
          damaged={damaged}
        />
      ))}
    </Box>
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
      <Flex gap={1} flexWrap="wrap" alignItems="center" direction="row">
        {blockValue.map((item, index) => (
          <DataValueDisplayView key={index} item={item} compact={compact} damaged={damaged} />
        ))}
      </Flex>
    )
  }

  switch (type) {
    case 'paragraph':
      return (
        <Box
          color="su.black"
          fontWeight="medium"
          lineHeight="relaxed"
          wordBreak="break-word"
          overflowWrap="break-word"
          whiteSpace="normal"
          fontSize={fontSize}
          mb={2}
        >
          {parsedValue}
        </Box>
      )

    case 'heading': {
      // Render as bold Text, not true HTML heading
      // Level 1: larger, Level 2: slightly smaller, Level 3: same as paragraph but bold
      const level = block.level || 3
      let headingFontSize: string
      if (level === 1) {
        headingFontSize = compact ? 'lg' : 'xl'
      } else if (level === 2) {
        headingFontSize = compact ? 'md' : 'lg'
      } else {
        // Level 3: same size as paragraph
        headingFontSize = fontSize
      }

      return (
        <Text
          as="span"
          fontWeight="bold"
          fontSize={headingFontSize}
          color="su.black"
          lineHeight="relaxed"
          display="block"
        >
          {parsedValue}
        </Text>
      )
    }

    case 'list-item':
      return (
        <Box color="su.black" fontWeight="medium" lineHeight="relaxed" fontSize={fontSize} pl={2}>
          <Text as="span" fontWeight="bold" mr={1}>
            -
          </Text>
          {block.label && (
            <Text as="span" fontWeight="bold">
              {block.label}:
            </Text>
          )}
          {parsedValue}
        </Box>
      )
    case 'hint':
      return (
        <Box
          color="su.black"
          fontWeight="normal"
          fontStyle="italic"
          lineHeight="relaxed"
          wordBreak="break-word"
          overflowWrap="break-word"
          whiteSpace="normal"
          overflow="hidden"
          maxW="100%"
          fontSize={fontSize}
        >
          {parsedValue}
        </Box>
      )

    case 'label':
      return (
        <Box>
          {block.label && (
            <Text variant="pseudoheader" fontSize="xs" mb={1}>
              {block.label}
            </Text>
          )}
          <Box color="su.black" fontWeight="medium" lineHeight="relaxed" fontSize={fontSize}>
            {parsedValue}
          </Box>
        </Box>
      )

    default:
      // Fallback for unknown types - render as paragraph
      return (
        <Box color="su.black" fontWeight="medium" lineHeight="relaxed" fontSize={fontSize}>
          {parsedValue}
        </Box>
      )
  }
}
