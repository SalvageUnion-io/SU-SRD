import type { CSSProperties } from 'react'
import { borderWidth, color, layer, radius, space } from '../../design/tokens'

/**
 * The one surface every floating panel stands on, in its two grounds.
 *
 * - `paper` — a paper panel on a 2px ink frame, lifted by an ink-tinted
 *   shadow: `PopoverPanel`'s default chrome, `HeaderMenu`'s popup, the search
 *   dropdown (`SearchIsland`) and the phone's search sheet (`MobileSearchDialog`).
 * - `ink` — paper on ink, with the medium lift shadow: the two hover
 *   surfaces (`Tooltip`, `StatProvenance`, through `INK_POPUP`).
 *
 * Surface only: background, frame, radius, shadow and text colour. Each
 * popup spreads it and adds its own size, padding and layout; its stacking is
 * a `layer` token on its positioner.
 */
export const POPUP_SURFACE = {
  paper: {
    backgroundColor: color.paper,
    borderColor: color.ink,
    borderRadius: radius.card,
    borderStyle: 'solid',
    borderWidth: borderWidth.pill,
    boxShadow: `0 14px 28px -14px ${color.ink50}`,
    color: color.ink,
  },
  ink: {
    backgroundColor: color.ink,
    borderRadius: radius.card,
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // design-tokens-ignore: the medium lift shadow, neutral black
    color: color.paper,
  },
} as const satisfies Record<'paper' | 'ink', CSSProperties>

/**
 * The ink popup both hover surfaces share (`Tooltip`, `StatProvenance`): the
 * ink surface with its inline padding, at the overlay layer. Each spreads it
 * and adds its own size, type and vertical padding.
 */
export const INK_POPUP = {
  ...POPUP_SURFACE.ink,
  paddingInline: space[12],
  zIndex: layer.overlay,
} satisfies CSSProperties
