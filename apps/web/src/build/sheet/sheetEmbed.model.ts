/**
 * A sheet shown inside another screen (Play's sheet pane, play.md §18). That
 * screen holds the page's one `<main>`, so the sheet draws none of its own,
 * and its Pilot | Mech | Crawler switch asks the host to show the other unit
 * rather than leaving for its page in Build.
 */

import type { SheetKind } from 'game-domain/entityKinds'
import { createContext, useContext } from 'react'

export type SheetEmbed = {
  /** Show that unit's sheet here; undefined when the host cannot (the switch links as ever). */
  show: (kind: SheetKind, id: string) => (() => void) | undefined
}

export const SheetEmbedContext = createContext<SheetEmbed | null>(null)

/** The host a sheet stands inside, or null on a sheet's own page. */
export function useSheetEmbed(): SheetEmbed | null {
  return useContext(SheetEmbedContext)
}
