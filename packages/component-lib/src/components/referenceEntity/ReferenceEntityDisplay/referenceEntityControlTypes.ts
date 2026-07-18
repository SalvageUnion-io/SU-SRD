import type { ReactNode } from 'react'

export type ReferenceEntityControlVariant = 'primary' | 'danger' | 'ghost'

export type ReferenceEntityControl = {
  key: string
  /**
   * Arbitrary content rendered in the control strip instead of a button — e.g. a
   * CountStepper, a status Badge, or a nav link. When set, the button fields
   * (label / onClick / ariaLabel / segmentText / icon / variant) are ignored.
   * This is the escape hatch that lets `controls` carry everything the old
   * `footActions` slot did, so no action ever renders in the footer.
   */
  node?: ReactNode
  label?: string
  /** Required for button controls (omit only when `node` is set). */
  onClick?: () => void
  /** Required for button controls (omit only when `node` is set). */
  ariaLabel?: string
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
