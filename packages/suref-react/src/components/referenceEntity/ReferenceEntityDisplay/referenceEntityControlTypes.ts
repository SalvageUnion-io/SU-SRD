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
  /** Content shown in a hover card when the user hovers over the control button */
  hoverContent?: ReactNode
}
