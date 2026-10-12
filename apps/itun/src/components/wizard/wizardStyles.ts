import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'

/**
 * Style objects the wizard steps share (refit TW-e). Rules a style object
 * cannot hold (responsive, stateful, child-selector stacks) are in
 * `styles/wizard.css`.
 */

/** The prose/form column a form step sits in (a 48rem measure). */
export const stepColumnStyle: CSSProperties = { maxWidth: '48rem' }

/** An input with its Roll button beside it. */
export const fieldRowStyle: CSSProperties = { display: 'flex', gap: tokens.space[8] }

/**
 * Small body copy at the `text-sm` rung, whose line height (1.25rem) comes
 * with the size.
 */
export const textSmStyle: CSSProperties = {
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
}

/** A pick step's full-width body. */
export const fullWidthStyle: CSSProperties = { width: '100%' }

/** A small dialog's paper body: copy, fields, then the actions row. */
export const dialogBodyStyle: CSSProperties = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[20],
}

/** The dialog's explanatory line. */
export const dialogNoteStyle: CSSProperties = {
  ...textSmStyle,
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
}

/** The dialog's buttons, right-aligned. */
export const dialogActionsStyle: CSSProperties = {
  display: 'flex',
  gap: tokens.space[8],
  justifyContent: 'flex-end',
}
