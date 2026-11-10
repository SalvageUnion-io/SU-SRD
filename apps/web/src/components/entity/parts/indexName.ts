import type { CSSProperties } from 'react'
import { weight } from '../../../design/tokens'
import { capsLabel } from '../../atoms/capsLabel'

/**
 * A catalog index Compact's name on its cut-out of the paper below, in ink (ruleset,
 * "Chapter band"): the index Compact's, and the cards Start Here and the SRD home's
 * Discord band draw from the same `.su-entity-index` classes. Whole, never "…"
 * (hard rule R56): a catalog is where a reader finds a thing by its name, so
 * the chips beside it leave for the body's first row (or +MORE) before it
 * gives way (`chipFill.ts`), and a name wider than its band wraps between
 * words.
 */
export const INDEX_NAME = {
  color: 'var(--color-ink)',
  display: 'block',
  fontWeight: weight.extrabold,
  lineHeight: 1.05,
  margin: 0,
  minWidth: 0,
  overflowWrap: 'break-word',
} satisfies CSSProperties
export const INDEX_NAME_CAPS = capsLabel({ size: 'title', weight: 'inherit' })
