import type { ReactNode } from 'react'

export type EntityControlVariant = 'primary' | 'danger' | 'ghost'

export type EntityControl = {
  key: string
  icon: (props: { className?: string }) => ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: EntityControlVariant
  className?: string
}
