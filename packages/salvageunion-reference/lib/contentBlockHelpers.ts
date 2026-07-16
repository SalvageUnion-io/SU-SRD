/**
 * Helper functions for working with content blocks in entity data
 */

import type { SURefObjectContentBlock, SURefObjectDataValue } from './types/index.js'

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

/**
 * Resolve a data value's numeric value against an effective tech level, applying
 * its `perTechLevel` scaling ("+N per Tech Level after the first"). Used for
 * granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle damage).
 *
 * The base value is the entity's TL1 value; each tech level above the first adds
 * `perTechLevel`. A value with no `perTechLevel`, a non-numeric value, or an
 * undefined/≤1 effective level returns the base unchanged.
 *
 * @returns `{ value, scaled }` — the resolved numeric value and whether scaling
 * actually changed it (drives the "modified" highlight in the UI).
 */
export function resolveDataValueForTechLevel(
  dv: SURefObjectDataValue,
  effectiveTechLevel: number | undefined
): { value: number | string | undefined; scaled: boolean } {
  const base = dv.value
  if (
    dv.perTechLevel === undefined ||
    typeof base !== 'number' ||
    effectiveTechLevel === undefined ||
    effectiveTechLevel <= 1
  ) {
    return { value: base, scaled: false }
  }
  const bumped = base + dv.perTechLevel * (effectiveTechLevel - 1)
  return { value: bumped, scaled: bumped !== base }
}
