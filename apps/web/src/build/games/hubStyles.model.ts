/**
 * The Game page's section layout (board M2): two columns of `HubSection`s that
 * become one on a phone without a media query — `min(100%, 26rem)` is what
 * keeps a 390px screen from scrolling sideways — and the copy under a stamp.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

const { space } = tokens

/** The page's measure under its band: Shelves', and the SRD's. */
export const GAME_MEASURE = '75rem'

/**
 * The page body under the band (`PageShell`'s measured body, at
 * `GAME_MEASURE`): its height reserves a stable footprint, so the roster
 * replacing the skeleton does not shift the page.
 */
export const GAME_BODY = { minHeight: '60vh' } satisfies CSSProperties

/** The two columns of sections under the roster. */
export const HUB_COLUMNS = { alignItems: 'start', marginTop: space[40] } satisfies CSSProperties

/** `HUB_COLUMNS`' narrowest column (a `Grid`'s `min`). */
export const HUB_COLUMN_MIN = '26rem'

/** One column: its sections stacked. */
export const HUB_COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  minWidth: 0,
} satisfies CSSProperties
