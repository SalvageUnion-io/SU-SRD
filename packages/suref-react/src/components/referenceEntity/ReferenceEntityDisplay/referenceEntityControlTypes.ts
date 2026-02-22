import type { ReactNode } from 'react'

export type ReferenceEntityControlVariant = 'primary' | 'danger' | 'ghost'

export type ReferenceEntityControl = {
  key: string
  label?: string
  onClick: () => void
  ariaLabel: string
  icon?: (props: { className?: string }) => ReactNode
  variant?: ReferenceEntityControlVariant
  disabled?: boolean
  /** Override the primary segment background color (CSS value, e.g. 'var(--color-su-green)') */
  bgColor?: string
  /** Override the primary segment text color */
  textColor?: string
  /** Override the border color */
  borderColor?: string
  /** Secondary segment text (renders in inverse style, like the value part of ValueDisplay) */
  segmentText?: string
  className?: string
  /** When true, the button is not rendered but still participates in header click behavior */
  hidden?: boolean
  /** When true, this control's onClick makes the entire card clickable (any mode).
   * The card gains a hover enlarge effect. If multiple controls set cardClick, the last one wins. */
  cardClick?: boolean
  /** Content shown in a hover card when the user hovers over the control button */
  hoverContent?: ReactNode
}
