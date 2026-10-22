import type { CSSProperties } from 'react'
import { duration, ease } from '../../design/tokens'

/**
 * The colour transition: the colour properties over `duration.fast`, a state
 * change, on the one `ease`.
 * A style object (not a class beside `interaction.ts`'s) because every user
 * spreads it into a static style object of its own.
 */
export const TRANSITION_COLORS = {
  transitionDuration: duration.fast,
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: ease,
} satisfies CSSProperties
