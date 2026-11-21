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
 * The main column and the sidebar, side by side while both fit. No top margin:
 * the page body's own padding is the space under the band (§1.7).
 */
export const HUB_COLUMNS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[24],
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

/** A section's actions as its body: a row under the heading, wrapping. */
export const HUB_ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[8],
} satisfies CSSProperties
