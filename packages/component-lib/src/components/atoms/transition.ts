import type { CSSProperties } from 'react'

/**
 * The colour transition: the colour properties over 150ms, standard easing.
 * A style object (not a class beside `interaction.ts`'s) because every user
 * spreads it into a static style object of its own.
 */
export const TRANSITION_COLORS = {
  transitionDuration: '150ms',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
} satisfies CSSProperties
