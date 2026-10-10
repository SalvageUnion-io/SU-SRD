/**
 * The Mediator Dashboard's shared style objects (docs/architecture/
 * mediator-dashboard.md §6): the instrument panels sit on the canvas's
 * `--color-ink-deep` ground in `--color-band-cream`, and the display is
 * `--color-paper`, as on the player Dashboard (ruleset §1).
 *
 * Style objects over `tokens` only: no `.pc-*` class and no Tailwind utility
 * (tailwind-removal.md §4; `bun run check styling` ratchets both).
 */

import { tokens } from 'component-lib'
import type { CSSProperties } from 'react'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

/** An instrument panel: the rail, The table, the two minors. */
export const PANEL: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[12],
  background: color.bandCream,
  border: `${borderWidth.rail} solid color-mix(in srgb, ${color.ink} 35%, transparent)`,
  borderRadius: radius.panel,
}

/** A minor's ontology band along its top edge (the crawler's pink). */
export const bandTop = (fill: string): CSSProperties => ({
  ...PANEL,
  borderTop: `8px solid ${fill}`,
})

/** A panel's heading: condensed caps, ink. */
export const HEADING: CSSProperties = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.readout,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  lineHeight: 1.1,
}

/** The small caps line beside or under a heading. */
export const EYEBROW: CSSProperties = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
}

/** Body copy on an instrument or the display. */
export const BODY: CSSProperties = {
  margin: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  lineHeight: 1.45,
  color: color.ink,
}

export const MUTED: CSSProperties = { ...BODY, color: color.ink75 }

/** Numbers line up. */
export const NUMBERS: CSSProperties = { fontVariantNumeric: 'tabular-nums' }

/** A heading with something at its far end. */
export const HEAD_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: space[12],
}

/** Read by a screen reader only. */
export const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}
