import type { ReactNode } from 'react'

export type ReferenceEntityControlVariant = 'primary' | 'danger' | 'ghost'

export type ReferenceEntityControl = {
  key: string
  icon: (props: { className?: string }) => ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: ReferenceEntityControlVariant
  className?: string
  label?: string
  /** When true, the button is not rendered but still participates in header click behavior */
  hidden?: boolean
  /** When true, this control's onClick makes the entire card clickable (any mode).
   * The card gains a hover enlarge effect. If multiple controls set cardClick, the last one wins. */
  cardClick?: boolean
  /** Content shown in a hover card when the user hovers over the control button */
  hoverContent?: ReactNode
}
