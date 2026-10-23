import type { CSSProperties } from 'react'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../../design/tokens'
import { TABULAR } from './vitalGaugeCompact'

/** VitalGauge's full-rung head style objects: the stamp, the numeral and its max controls. */

export const HEAD = {
  marginBottom: space[8],
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[8],
} satisfies CSSProperties
export const HEAD_LEFT = {
  display: 'flex',
  minWidth: 0,
  alignItems: 'baseline',
  gap: space[6],
} satisfies CSSProperties
export const STAMP = {
  padding: `${space[2]} ${space[6]}`,
  fontSize: fontSize.caption,
  lineHeight: 1.5,
} satisfies CSSProperties
export const SUB_LABEL = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1,
  color: color.wkMuted,
} satisfies CSSProperties
export const NUMERAL = {
  ...TABULAR,
  whiteSpace: 'nowrap',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  lineHeight: 1,
} satisfies CSSProperties
export const SLASH = {
  paddingInline: space[2],
  fontStyle: 'normal',
  fontSize: fontSize.readout,
  color: color.ink75,
} satisfies CSSProperties
export const MAX_INPUT = {
  ...TABULAR,
  width: '56px',
  borderRadius: radius.card,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  borderColor: color.ink40,
  backgroundColor: color.paper,
  paddingInline: space[4],
  textAlign: 'center',
  fontSize: fontSize.readout,
  color: color.ink,
} satisfies CSSProperties
export const MAX_BUTTON = {
  cursor: 'pointer',
  borderRadius: radius.badge,
  paddingInline: space[2],
  fontSize: fontSize.readout,
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: '2px',
} satisfies CSSProperties
export const MAX_TEXT = { fontSize: fontSize.readout, color: color.ink75 } satisfies CSSProperties
export const OVERRIDE_SUP = {
  marginLeft: space[2],
  fontSize: fontSize.badge,
  fontWeight: weight.bold,
  color: 'var(--tone-deep)',
} satisfies CSSProperties
export const REVERT = {
  marginLeft: space[4],
  cursor: 'pointer',
  verticalAlign: 'middle',
  fontSize: fontSize.caption,
} satisfies CSSProperties
/**
 * The Full rung's − / + (Play's table mode): under the track, the pair
 * sharing its width, each the Full Size tall (44px), so a thumb finds it
 * without looking.
 */
export const STEPPERS_FULL = {
  display: 'flex',
  gap: space[8],
  marginTop: space[8],
} satisfies CSSProperties
export const STEP_FULL = {
  flex: '1 1 0%',
  fontSize: fontSize.display,
  height: 'var(--size-full)',
  width: 'auto',
} satisfies CSSProperties
/** The full rung's track and caption. */
export const ROOT = { width: '100%', paddingBlock: space[4] } satisfies CSSProperties
export const PIP = {
  minHeight: 0,
  minWidth: 0,
  flex: 1,
  borderWidth: borderWidth.chrome,
  // `solid`, set explicitly: a segment once rendered as a `<button>`, whose
  // base-layer `border: none` made an unlit pip vanish in Edit while Read drew it.
  borderStyle: 'solid',
  padding: 0,
} satisfies CSSProperties
export const PIP_DENSE = {
  height: 'var(--size-mini)',
  borderRadius: radius.badge,
} satisfies CSSProperties
export const PIP_ROOMY = { height: '22px', borderRadius: radius.card } satisfies CSSProperties
export const CAPTION = {
  marginTop: space[6],
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: space[4],
  lineHeight: 1,
  color: color.ink75,
} satisfies CSSProperties
export const CAPTION_OVERRIDE = {
  marginRight: 'auto',
  letterSpacing: tracking.capsSnug,
  color: 'var(--tone-deep)',
} satisfies CSSProperties
