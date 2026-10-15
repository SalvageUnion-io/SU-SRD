import type { CSSProperties } from 'react'
import { font, fontSize, tracking, weight } from '../../../design/tokens'

/**
 * A catalog tile's name on its cut-out of the paper below, in ink (ruleset,
 * "Chapter band"): the Tile's, and the tiles Start Here and the SRD home's
 * Discord band draw from the same `.su-entity-tile` classes.
 */
export const TILE_NAME = {
  color: 'var(--color-ink)',
  display: '-webkit-box',
  fontFamily: font.cond,
  fontSize: fontSize.title,
  fontWeight: weight.extrabold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1.05,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textTransform: 'uppercase',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
} satisfies CSSProperties
