import type { StatBorderState } from './Stat'

export type StatItem = {
  key: string
  label: string
  value: number | string | undefined
  outOfMax?: number
  bottomLabel?: string
  // Visual
  hoverText?: string
  inverse?: boolean
  /** State overlay — drives the Stat cell's border colour only (see StatBorderState). */
  state?: StatBorderState
  flash?: boolean
  disabled?: boolean
  ariaLabel?: string
  // Interactivity — presence of onChange renders Stat in edit mode (+/- buttons)
  onChange?: (newValue: number) => void
  canEdit?: boolean // controls whether +/- are enabled (only when onChange present)
  // Click — makes the stat box itself a button
  onClick?: () => void
}
