/**
 * usePlayWide — whether Play is wide enough for its three columns: the `lg`
 * rung `PlayFrame`'s container queries switch at (chrome.md K2, play.md §2).
 * The frame's host spans the window and never scrolls, so the window's width
 * is the container's. A screen reads it once and hands it to its frame and
 * its bar.
 */

import { widthAtLeast } from '../design/tokens'
import { useMediaQuery } from '../lib/useMediaQuery'

export function usePlayWide(): boolean {
  return useMediaQuery(widthAtLeast('lg'))
}
