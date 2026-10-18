import type { CSSProperties } from 'react'
import { borderWidth, color, layer, radius, shadow, space } from '../../design/tokens'

/**
 * The one surface every floating panel stands on, in its two grounds.
 *
 * - `paper` — a paper panel on a 2px ink frame, lifted by the lift: `PopoverPanel`'s default chrome, `HeaderMenu`'s popup, the search
 *   dropdown (`SearchIsland`) and the phone's search sheet (`MobileSearchDialog`).
 * - `ink` — paper on ink, lifted the same: the two hover
 *   surfaces (`Tooltip`, `StatProvenance`, through `INK_POPUP`).
 *
 * Surface only: background, frame, radius, the one lift (`shadow.lift`, chrome K4)
 * and text colour. Each
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
    boxShadow: shadow.lift,
    color: color.ink,
  },
  ink: {
    backgroundColor: color.ink,
    borderRadius: radius.card,
    boxShadow: shadow.lift,
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
