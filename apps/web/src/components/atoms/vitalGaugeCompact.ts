import type { CSSProperties } from 'react'
import { borderWidth, font, fontSize, radius, space, weight } from '../../design/tokens'

/** VitalGauge's compact-form style objects (one row of pips under a caption). */

export const TABULAR = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties

export const C_READOUT = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties
export const C_HEAD = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[8],
} satisfies CSSProperties
export const C_LABEL = { flexShrink: 0, lineHeight: 1 } satisfies CSSProperties
export const C_VALUE = {
  ...TABULAR,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontSize: fontSize.caption,
  fontWeight: weight.bold,
  lineHeight: 1,
} satisfies CSSProperties
export const C_ROWS = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: '3px',
} satisfies CSSProperties
export const C_ROW = {
  display: 'flex',
  minWidth: 0,
  justifyContent: 'center',
  gap: '3px',
} satisfies CSSProperties
export const C_PIP = {
  height: '14px',
  width: 'calc((100% - 15px) / 6)',
  minWidth: 0,
  flexShrink: 0,
  borderRadius: radius.badge,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
} satisfies CSSProperties
export const C_SHELL = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: space[8],
} satisfies CSSProperties
