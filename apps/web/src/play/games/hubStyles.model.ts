/**
 * The Game page's section layout: a main column of `SlabSection`s and a
 * small sidebar for the table's people, which drops below the main column
 * once they no longer fit side by side, without a media query —
 * `min(100%, 26rem)` is what keeps a 390px screen from scrolling sideways.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

const { space } = tokens

/**
 * The page body under the band (`PageShell`'s measured body, at
 * `PAGE_MEASURE`): its height reserves a stable footprint, so the roster
 * replacing the skeleton does not shift the page.
 */
export const GAME_BODY = { minHeight: '60vh' } satisfies CSSProperties

/** The main column and the sidebar, side by side while both fit. */
export const HUB_COLUMNS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[24],
  marginTop: space[24],
} satisfies CSSProperties

const COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  minWidth: 0,
} satisfies CSSProperties

/** The main column: its sections stacked, taking every width the sidebar leaves. */
export const HUB_MAIN = { ...COLUMN, flex: '999 1 min(100%, 26rem)' } satisfies CSSProperties

/** The sidebar: the table's people, small. */
export const HUB_SIDEBAR = { ...COLUMN, flex: '1 1 18rem' } satisfies CSSProperties

/** A section's body: what it holds, 8px apart (its head is `SlabSection`'s 8px above). */
export const HUB_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties
