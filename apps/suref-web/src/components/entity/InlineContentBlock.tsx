import { Box } from '@chakra-ui/react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { parseContentBlockString } from '../../lib/contentBlockHelpers'

interface InlineContentBlockProps {
  block: SURefObjectContentBlock
  fontSize: string
  chassisName?: string
}

/**
 * Render a single content block inline (as span, not block)
 */
export function InlineContentBlock({ block, fontSize, chassisName }: InlineContentBlockProps) {
  const type = block.type || 'paragraph'
  const stringValue = parseContentBlockString(block, chassisName)
  const parsedValue = useParseTraitReferences(stringValue)

  // Only render paragraph and hint types inline (others should be block-level)
  if (type === 'paragraph' || type === 'hint') {
    return (
      <>
        {' '}
        <Box
          as="span"
          display="inline"
          fontWeight={type === 'hint' ? 'normal' : 'medium'}
          fontStyle={type === 'hint' ? 'italic' : 'normal'}
          fontSize={fontSize}
          lineHeight="relaxed"
          whiteSpace="normal"
          color="su.black"
        >
          {parsedValue}
        </Box>
      </>
    )
  }

  // For other types, render as block (shouldn't happen in inline context, but fallback)
  return null
}
