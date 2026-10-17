/**
 * The Mediator Dashboard's shared style objects (docs/architecture/
 * mediator-dashboard.md §6): the text inside its sections. The sections
 * themselves are `TitledBox`es on the canvas's `--color-ink-deep` ground, and
 * the display is `--color-paper`, as on the player Dashboard (ruleset §1).
 *
 * Style objects over `tokens` only: no Dashboard stylesheet class (ADR-046).
 */

import type { CSSProperties } from 'react'
import { tokens } from '../index'

const { color, font, fontSize, space } = tokens

/** Body copy on an instrument or the display. */
export const BODY = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.45,
  color: color.ink,
} satisfies CSSProperties

export const MUTED = { ...BODY, color: color.ink75 } satisfies CSSProperties

/** Numbers line up. */
export const NUMBERS = { fontVariantNumeric: 'tabular-nums' } satisfies CSSProperties

/** A heading with something at its far end. */
export const HEAD_ROW = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[12],
} satisfies CSSProperties
