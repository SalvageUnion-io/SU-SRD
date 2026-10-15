import type { CSSProperties } from 'react'
import { tokens } from '../index'

/**
 * Style objects the wizard steps share. Rules a style object
 * cannot hold (responsive, stateful, child-selector stacks) are in
 * `styles/wizard.css`.
 */

/** The prose/form column a form step sits in (a 48rem measure). */
export const stepColumnStyle = { maxWidth: '48rem' } satisfies CSSProperties

/** An input with its Roll button beside it. */
export const fieldRowStyle = { display: 'flex', gap: tokens.space[8] } satisfies CSSProperties

/**
 * Small body copy at the `sm` size rung, whose line height (1.25rem) comes
 * with the size.
 */
export const textSmStyle = {
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
} satisfies CSSProperties

/** A pick step's full-width body. */
export const fullWidthStyle = { width: '100%' } satisfies CSSProperties

/** A small dialog's paper body: copy, fields, then the actions row. */
export const dialogBodyStyle = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
} satisfies CSSProperties

/** The dialog's explanatory line. */
export const dialogNoteStyle = {
  ...textSmStyle,
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
} satisfies CSSProperties

/** The dialog's buttons, right-aligned. */
export const dialogActionsStyle = {
  display: 'flex',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties
