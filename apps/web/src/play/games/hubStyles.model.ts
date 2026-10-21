/**
 * The Game page's section layout (board M2): two columns of `SlabSection`s that
 * become one on a phone without a media query — `min(100%, 26rem)` is what
 * keeps a 390px screen from scrolling sideways — and the copy under a stamp.
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

/** The two columns of sections under the roster. */
export const HUB_COLUMNS = { alignItems: 'start', marginTop: space[24] } satisfies CSSProperties

/** `HUB_COLUMNS`' narrowest column (a `Grid`'s `min`). */
export const HUB_COLUMN_MIN = '26rem'

/** One column: its sections stacked. */
export const HUB_COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
  minWidth: 0,
} satisfies CSSProperties

/** A section's body: what it holds, 8px apart (its head is `SlabSection`'s 8px above). */
export const HUB_BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties
