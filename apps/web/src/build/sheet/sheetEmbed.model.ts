/**
 * A sheet shown inside another screen (Play's sheet pane, play.md §18). That
 * screen holds the page's one `<main>`, so the sheet draws none of its own,
 * and its Pilot | Mech | Crawler switch asks the host to show the other unit
 * rather than leaving for its page in Build.
 */

import { createContext, useContext } from 'react'

export type SheetEmbed = {
  /** Show that unit's sheet here; undefined when the host cannot (the switch links as ever). */
  show: (kind: string, id: string) => (() => void) | undefined
}

export const SheetEmbedContext = createContext<SheetEmbed | null>(null)

/** The host a sheet stands inside, or null on a sheet's own page. */
export function useSheetEmbed(): SheetEmbed | null {
  return useContext(SheetEmbedContext)
}

/**
 * The switch's press for another unit (a segment's kind and id) inside a host
 * that can show it; undefined on a sheet's own page, where the switch links.
 */
export function swapHere(
  embed: SheetEmbed | null,
  kind: string,
  id: string | undefined
): { onClick: () => void } | undefined {
  const show = id === undefined ? undefined : embed?.show(kind, id)
  return show && { onClick: show }
}
