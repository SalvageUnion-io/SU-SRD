/**
 * The "New in the Feed" mark (r4 B7, play.md §8), pure: the Feed sits below
 * the fold from `lg` and on another tab on a phone, so a line somebody else
 * wrote there went unseen. A new one raises a small mark in Play's bar, which
 * jumps to it.
 */

import type { FeedEntry } from './feed.model'

/**
 * The newest line somebody else put in the Feed, by its key; null with none.
 * My own rolls and changes, and the table's lines for my own acts, are no
 * news to me.
 */
export function newestFromOthers(entries: readonly FeedEntry[]): string | null {
  let newest: FeedEntry | null = null
  for (const entry of entries) {
    // The last solo visit's lines (r7 A8) are history, never news.
    if (entry.kind === 'mine' || entry.kind === 'last' || ('own' in entry && entry.own === true))
      continue
    if (newest === null || entry.ts > newest.ts) newest = entry
  }
  return newest?.key ?? null
}

/**
 * Whether the Feed is out of sight: not on the screen at all (another phone
 * tab holds it), or wholly outside the window (below the fold, or scrolled
 * away above it). `box` is its section's box in the window.
 */
export function feedOutOfSight(
  box: { top: number; bottom: number } | null,
  windowHeight: number
): boolean {
  return box === null || box.top >= windowHeight || box.bottom <= 0
}

/**
 * Whether the mark goes up as the Feed's newest line changes from `before` to
 * `now`: never at first sight (`before` undefined: that is history), never
 * for a line going away, and only while the Feed is out of sight.
 */
export function raisesMark(
  before: string | null | undefined,
  now: string | null,
  outOfSight: boolean
): boolean {
  return before !== undefined && now !== null && now !== before && outOfSight
}
