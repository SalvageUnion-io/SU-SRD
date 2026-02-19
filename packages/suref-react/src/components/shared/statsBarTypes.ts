export type StatItem = {
  key: string
  label: string
  value: number | string | undefined
  outOfMax?: number
  bottomLabel?: string
  // Visual
  hoverText?: string
  inverse?: boolean
  bg?: string
  valueColor?: string
  borderColor?: string
  isOverMax?: boolean
  flash?: boolean
  disabled?: boolean
  ariaLabel?: string
  // Interactivity — presence of onChange renders StatControl (+/- buttons)
  onChange?: (newValue: number) => void
  canEdit?: boolean // controls whether +/- are enabled (only when onChange present)
  // Click — makes the stat box itself a button
  onClick?: () => void
}
