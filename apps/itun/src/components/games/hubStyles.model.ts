/**
 * The Game page's section layout (board M2): two columns of `HubSection`s that
 * become one on a phone without a media query — `min(100%, 26rem)` is what
 * keeps a 390px screen from scrolling sideways — and the copy under a stamp.
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'

const { color, font, fontSize, space } = tokens

/** The page's measure under its band: Shelves', and the SRD's. */
export const GAME_MEASURE = '75rem'

/**
 * The page body under the band. Its side padding and centring are
 * `.su-page-column`'s, the band's row padding; the height reserves a stable
 * footprint, so the roster replacing the skeleton does not shift the page.
 */
export const GAME_BODY: CSSProperties = {
  maxWidth: GAME_MEASURE,
  minHeight: '60vh',
  paddingBottom: space[48],
  paddingTop: space[20],
}

/** The two columns of sections under the roster. */
export const HUB_COLUMNS: CSSProperties = {
  alignItems: 'start',
  display: 'grid',
  gap: `${space[32]} ${space[32]}`,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))',
  marginTop: space[40],
}

/** One column: its sections stacked. */
export const HUB_COLUMN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[32],
  minWidth: 0,
}

/** Copy under a section's stamp. */
export const HUB_COPY: CSSProperties = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: 1.5,
  color: color.wkMuted,
}
