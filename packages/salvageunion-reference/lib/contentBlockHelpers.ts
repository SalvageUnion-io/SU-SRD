/**
 * Helper functions for working with content blocks in entity data
 */

import type { SURefObjectContentBlock } from './types/index.js'

/**
 * Extract the string value from a paragraph content block
 * @param content - Array of content blocks
 * @returns The string value from the first paragraph block, or undefined if not found
 */
export function getParagraphString(
  content: SURefObjectContentBlock[] | undefined
): string | undefined {
  if (!content) return undefined
  const block = content.find((b) => !b.type || b.type === 'paragraph')
  if (!block) return undefined
  return typeof block.value === 'string' ? block.value : undefined
}

/**
 * Replace [(CHASSIS)] placeholder with actual chassis name, prefixed with "The"
 *
 * @param text - Text that may contain [(CHASSIS)] placeholders
 * @param chassisName - Optional chassis name to replace placeholders with
 * @returns Text with placeholders replaced, or original text if no chassis name provided
 */
export function replaceChassisPlaceholder(text: string | undefined, chassisName?: string): string {
  if (!text) return ''
  if (!chassisName) return text
  return text.replace(/\[\(CHASSIS\)\]/g, `The ${chassisName}`)
}

/**
 * Extract and parse string value from a content block
 *
 * @param block - Content block to extract string value from
 * @param chassisName - Optional chassis name to replace [(CHASSIS)] placeholders
 * @returns Parsed string value with placeholders replaced
 */
export function parseContentBlockString(
  block: SURefObjectContentBlock,
  chassisName?: string
): string {
  const blockValue = block.value
  const stringValue = typeof blockValue === 'string' ? blockValue : ''
  return replaceChassisPlaceholder(stringValue, chassisName)
}
