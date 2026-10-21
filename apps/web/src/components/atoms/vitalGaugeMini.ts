import type { CSSProperties } from 'react'
import { borderWidth, space } from '../../design/tokens'
import { C_HEAD, C_LABEL, C_VALUE } from './vitalGaugeCompact'

/** VitalGauge's mini-form style objects (a square grid of cells under a caption). */

/** One cell's side: two cells and their gap fit a Mini's height (18px). */
export const M_CELL_SIDE = '8px'

export const M_SHELL = {
  display: 'inline-flex',
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties
export const M_HEAD = C_HEAD
export const M_LABEL = C_LABEL
export const M_VALUE = C_VALUE
export const M_GRID = {
  display: 'grid',
  gap: space[2],
  justifyContent: 'start',
} satisfies CSSProperties
export const M_CELL = {
  height: M_CELL_SIDE,
  width: M_CELL_SIDE,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
} satisfies CSSProperties

/** Columns that make the cells a square block: 9 HP is 3x3, 10 is 4 + 4 + 2. */
export function miniColumns(count: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(count)))
}
