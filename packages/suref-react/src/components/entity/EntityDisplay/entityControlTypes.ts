export type EntityControlVariant = 'primary' | 'danger' | 'ghost'

export type EntityControl = {
  key: string
  icon: (props: { className?: string }) => React.ReactNode
  onClick: () => void
  ariaLabel: string
  variant?: EntityControlVariant
  className?: string
}
