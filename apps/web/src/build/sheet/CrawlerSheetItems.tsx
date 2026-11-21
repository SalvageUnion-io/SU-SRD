/**
 * CrawlerSheetItems — a crawler bay's entry type and its rules text split
 * (the dashboard's bay line opens the halves).
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { RefCrawlerBay } from 'salvageunion-reference'

export type CrawlerBayEntry = NonNullable<Crawler['crawlerBays']>[number]

/**
 * Several bays ALSO restate their damaged clause as a trailing content
 * paragraph, so hiding `damagedEffect` alone still left it on the card. This
 * catches that duplicate.
 */
const WHEN_DAMAGED = /\b(?:is|becomes|are|become)\s+damaged\b/i

type BayContent = NonNullable<RefCrawlerBay['content']>

/** Split a bay's rules content into its always-true half and its damaged half. */
export function splitBayContent(content: RefCrawlerBay['content']): {
  normal: BayContent
  damaged: string[]
} {
  const normal: BayContent = []
  const damaged: string[] = []
  for (const block of content ?? []) {
    const { value } = block
    if (typeof value === 'string' && WHEN_DAMAGED.test(value)) damaged.push(value)
    else normal.push(block)
  }
  return { normal, damaged }
}
