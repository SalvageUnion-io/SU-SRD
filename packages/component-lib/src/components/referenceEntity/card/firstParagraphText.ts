import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { parseContentBlockString } from 'salvageunion-reference'

/** First paragraph of a content array as plain text — the pattern-listing hint
 * and a catalog choice's prompt prose. */
export function firstParagraphText(
  content: SURefObjectContentBlock[] | undefined
): string | undefined {
  const paragraph = content?.find((block) => block?.type === 'paragraph')
  return paragraph ? parseContentBlockString(paragraph) : undefined
}
