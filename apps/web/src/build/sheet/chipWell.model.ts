/**
 * The one chip well (`ChipListEditor`, ruleset §6.6) and its draft fields'
 * widths, kept apart from the component so a test can pin them.
 */

import type { CSSProperties } from 'react'
import { tokens } from '../../components/index'

const { borderWidth, color, radius, size, space } = tokens

/** The one well around the chip row: §4.4's scale, never the 10px rung. */
export const CHIP_WELL = {
  alignItems: 'center',
  backgroundColor: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[6],
  // One Compact line (the draft field) in the well's padding and frame.
  minHeight: `calc(${size.compact} + 2 * ${space[8]} + 2 * ${borderWidth.chrome})`,
  padding: space[8],
} satisfies CSSProperties

/** A condition's draft field: a chip's word wide. */
export const CONDITION_DRAFT = '9rem'

/** A fact's draft field: a short sentence wide. */
export const FACT_DRAFT = '12rem'
