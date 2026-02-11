import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../utils/parseTraitReferences'
import { parseContentBlockString } from '../../lib/contentBlockHelpers'
import { cn } from '../../utils/cn'

type InlineContentBlockProps = {
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
        <span
          className={cn(
            'inline leading-relaxed whitespace-normal text-su-black',
            type === 'hint' ? 'font-normal italic' : 'font-medium',
            fontSize
          )}
        >
          {parsedValue}
        </span>
      </>
    )
  }

  // For other types, render as block (shouldn't happen in inline context, but fallback)
  return null
}
