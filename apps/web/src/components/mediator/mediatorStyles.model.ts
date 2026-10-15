/**
 * The Mediator Dashboard's shared style objects (docs/architecture/
 * mediator-dashboard.md §6): the instrument panels sit on the canvas's
 * `--color-ink-deep` ground in `--color-band-cream`, and the display is
 * `--color-paper`, as on the player Dashboard (ruleset §1).
 *
 * Style objects over `tokens` only: no Dashboard stylesheet class (ADR-046).
 */

import type { CSSProperties } from 'react'
import { tokens } from '../index'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

/** An instrument panel: the rail, The table, the two minors. */
export const PANEL = {
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[12],
  background: color.bandCream,
  border: `${borderWidth.rail} solid color-mix(in srgb, ${color.ink} 35%, transparent)`,
  borderRadius: radius.panel,
} satisfies CSSProperties

/** A minor's ontology band along its top edge (the crawler's pink). */
export const bandTop = (fill: string): CSSProperties => ({
  ...PANEL,
  borderTop: `8px solid ${fill}`,
})

/** A panel's heading: condensed caps, ink. */
export const HEADING = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  lineHeight: 1.1,
} satisfies CSSProperties

/** The small caps line beside or under a heading. */
export const EYEBROW = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
} satisfies CSSProperties

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
