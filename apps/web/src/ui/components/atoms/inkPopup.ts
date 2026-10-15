import type { CSSProperties } from 'react'
import { color, space } from '../../design/tokens'

/**
 * The ink popup both hover surfaces share (`Tooltip`, `StatProvenance`):
 * paper on ink, rounded, with the medium lift shadow. Each spreads it and adds
 * its own size, type and vertical padding.
 */
export const INK_POPUP = {
  backgroundColor: color.ink,
  borderRadius: '0.375rem',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // design-tokens-ignore: the medium lift shadow, neutral black
  color: color.paper,
  paddingInline: space[12],
  zIndex: 50,
} satisfies CSSProperties
