import type { CSSProperties } from 'react'
import { borderWidth, color } from '../../design/tokens'

/**
 * The display region: the deck beside the tabs, over the strip. The ⤢ overlay
 * covers all of it.
 */
export const DISPLAY = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
} satisfies CSSProperties

/**
 * Deck and tabs side by side, the deck a little wider (its tiles pack in
 * columns). The one row is pinned to the region's height, not its content's,
 * so each side scrolls inside itself rather than pushing the strip off the
 * canvas.
 */
export const DECK_AND_TABS = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
} satisfies CSSProperties

/**
 * The Crew tab takes the whole display (board D2): a table of the crew's
 * vitals and status needs the width, and the deck has nothing to say to it.
 */
export const TABS_ALONE = {
  ...DECK_AND_TABS,
  gridTemplateColumns: 'minmax(0, 1fr)',
} satisfies CSSProperties

export const DECK = {
  minHeight: 0,
  borderRight: `${borderWidth.chrome} solid ${color.ink20}`,
} satisfies CSSProperties
