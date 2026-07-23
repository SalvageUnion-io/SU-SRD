import { createContext } from 'react'

/**
 * Whether the current subtree is INSIDE a tooltip popup. The Tooltip context
 * law (ruleset §1) is "Terminal — no buttons, links, nested tooltips, or
 * steppers, ever": a tooltip primitive rendered inside another tooltip's popup
 * renders its children bare instead of arming a nested hovercard. Provided by
 * the popup renderers (EntityTooltip); read by every tooltip primitive.
 */
export const InsideTooltipContext = createContext(false)
