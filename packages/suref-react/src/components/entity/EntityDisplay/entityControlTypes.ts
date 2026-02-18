import type { ReactNode } from 'react'

export type EntityControlVariant = 'primary' | 'danger' | 'ghost'

export type EntityControl = {
  key: string
  icon: (props: { className?: string }) => ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: EntityControlVariant
  className?: string
  label?: string
  /** When true, the button is not rendered but still participates in header click behavior */
  hidden?: boolean
  /** Content shown in a hover card when the user hovers over the control button */
  hoverContent?: ReactNode
}
