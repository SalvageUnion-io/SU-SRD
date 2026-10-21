import type { CSSProperties } from 'react'
import { weight } from '../../../design/tokens'
import { capsLabel } from '../../atoms/capsLabel'

/**
 * A catalog tile's name on its cut-out of the paper below, in ink (ruleset,
 * "Chapter band"): the CompactIndex's, and the tiles Start Here and the SRD home's
 * Discord band draw from the same `.su-entity-index` classes. One line: short
 * of room it ends in "…", never wraps (owner, round 4: "should ellipses off
 * and show in a peek"; a Compact's and a Mini's names alike, ruleset §4.7).
 */
export const INDEX_NAME = {
  color: 'var(--color-ink)',
  display: 'block',
  fontWeight: weight.extrabold,
  lineHeight: 1.05,
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties
export const INDEX_NAME_CAPS = capsLabel({ size: 'title', weight: 'inherit' })
