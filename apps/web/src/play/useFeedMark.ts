/**
 * useFeedMark — whether Play's bar wears "New in the Feed" (r4 B7,
 * `feedMark.model.ts`): up when somebody else's line lands while the Feed is
 * out of sight, down once the Feed is on the screen again (the mark's own
 * jump, a scroll, its tab).
 */

import { useEffect, useRef, useState } from 'react'
import type { FeedEntry } from './feed.model'
import { feedOutOfSight, newestFromOthers, raisesMark } from './feedMark.model'

/** The Feed section's box in the window, or null while no pane on the screen holds it. */
function feedBox(feedId: string): { top: number; bottom: number } | null {
  const feed = document.getElementById(feedId)
  if (feed === null) return null
  const { top, bottom } = feed.getBoundingClientRect()
  // A pane kept but not shown has no box at all.
  return top === 0 && bottom === 0 ? null : { top, bottom }
}

export function useFeedMark(
  entries: readonly FeedEntry[],
  /** The Feed section's element id (`PlayFeedSection`). */
  feedId: string
): { shown: boolean; clear: () => void } {
  const newest = newestFromOthers(entries)
  const before = useRef<string | null | undefined>(undefined)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const was = before.current
    before.current = newest
    if (raisesMark(was, newest, feedOutOfSight(feedBox(feedId), window.innerHeight))) {
      setShown(true)
    }
  }, [newest, feedId])
  // The Feed came into sight by itself (a scroll, its tab): the mark has done its job.
  useEffect(() => {
    if (!shown) return
    const check = () => {
      if (!feedOutOfSight(feedBox(feedId), window.innerHeight)) setShown(false)
    }
    // Capture: the panes scroll, not the window.
    window.addEventListener('scroll', check, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', check, { capture: true })
  }, [shown, feedId])
  return { shown, clear: () => setShown(false) }
}
