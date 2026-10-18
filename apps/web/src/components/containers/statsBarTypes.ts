import type { StatGroup } from 'salvageunion-reference'
import type { StatBorderState } from '../atoms/Stat'

export type StatItem = {
  key: string
  label: string
  value: number | string | undefined
  /** Its part of the stat order (`STATS`): where a group opens (a stat column's new row). */
  group?: StatGroup
  outOfMax?: number
  bottomLabel?: string
  // Visual
  hoverText?: string
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
