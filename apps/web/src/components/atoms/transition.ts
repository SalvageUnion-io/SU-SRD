import type { CSSProperties } from 'react'
import { ease } from '../../design/tokens'

/**
 * The colour transition: the colour properties over `--dur-fast`, a state
 * change, on the one `ease`.
 * A style object (not a class beside `interaction.ts`'s) because every user
 * spreads it into a static style object of its own.
 */
export const TRANSITION_COLORS = {
  transitionDuration: 'var(--dur-fast)',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: ease,
} satisfies CSSProperties
