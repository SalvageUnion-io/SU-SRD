import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { BlockContentRendererView } from '../BlockContentRendererView'

interface ContentBlockRendererProps {
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
 * ContentBlockRenderer - Renders an array of content blocks
 * Requires damaged prop to be passed explicitly
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
export function ContentBlockRenderer({
  content,
  fontSize = 'sm',
  compact = false,
  chassisName,
  damaged,
}: ContentBlockRendererProps) {
  return (
    <BlockContentRendererView
      content={content}
      fontSize={fontSize}
      compact={compact}
      chassisName={chassisName}
      damaged={damaged}
    />
  )
}
