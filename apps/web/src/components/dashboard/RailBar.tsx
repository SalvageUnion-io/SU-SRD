/**
 * RailBar — the Dashboard's top rail (boards D1–D3): the way back
 * to the Game, the SU mark, the pilot this Dashboard plays, a stamp for where
 * they are ("Boarded · Scrapper", "On foot", "Downtime · Step 3 of 10"), the
 * Game it saves to (set under the name), then — in Downtime — the pilot and mech as compact links
 * with their pips (`RailUnit`), whether play is being saved (`status`, the
 * app's `SavedIndicator`), and the Mediator's Start or End Downtime.
 *
 * Presentational only — the `.su-dash-rail` region wrapper (grid area + flex row +
 * forward border) is supplied by DashboardGrid's rail slot, and the app
 * injects its own router link via `returnControl` (src/components stays
 * routing-agnostic).
 */

import type { CSSProperties, ReactNode } from 'react'
import { MARK_SRC } from '../../lib/documentHead'
import { Badge, Button, tokens } from '../index'

type RailFam = 'mech' | 'pilot' | 'crawler'

/** The stamp's fill: the Major's ontology — crawler pink in Downtime. */
const STAMP_BG: Record<RailFam, string> = {
  mech: 'var(--color-ink)',
  pilot: 'var(--color-ink)',
  crawler: 'var(--color-crawler-band)',
}

const MARK = { display: 'block', flexShrink: 0 } satisfies CSSProperties

const NAME = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.readout,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  lineHeight: 1,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  flexShrink: 0,
} satisfies CSSProperties

/** Board D3 sets the stamp on one line: it never gives up width to its neighbours. */
const STAMP = { flexShrink: 0, whiteSpace: 'nowrap' } satisfies CSSProperties

/** Pushes the units, status and actions to the rail's end. */
const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

/**
 * The name and the context line stack: the context sets under the name rather
 * than after the stamp. In Downtime the rail units take the width, and inline
 * the context was the one thing left to give, cut to "You r…". Under the name
 * it costs no width it does not already have, and it never truncates.
 */
const IDENTITY = {
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: '2px',
} satisfies CSSProperties

const CONTEXT = {
  color: tokens.color.ink75,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const UNITS = {
  alignItems: 'center',
  display: 'flex',
  flexShrink: 0,
  gap: tokens.space[16],
} satisfies CSSProperties

export type RailBarProps = {
  /** The pilot this Dashboard plays. */
  name: string
  /** Where they are: "Boarded · Scrapper", "On foot", "Downtime · Step 3 of 10". */
  stamp: string
  fam?: RailFam
  /** What the play saves to: "Game · <name>", or "Run by the Mediator" in Downtime. */
  context?: string
  /** The way back — the app passes its router link (an AppLink). */
  returnControl?: ReactNode
  /** Downtime: the pilot and mech as compact links (`RailUnit`). */
  units?: ReactNode
  /** Saved / offline, at the right before the action (the app's `SavedIndicator`). */
  status?: ReactNode
  /**
   * The Mediator's Downtime control (ADR-038 §5): Start while it is not running,
   * End while it is.
   */
  downtimeAction?: { label: string; title: string; onClick: () => void }
}

export function RailBar({
  name,
  stamp,
  fam = 'mech',
  context,
  returnControl,
  units,
  status,
  downtimeAction,
}: RailBarProps) {
  return (
    <>
      {returnControl}
      <img src={MARK_SRC} alt="" width={24} height={24} style={MARK} />
      <span style={IDENTITY}>
        <span style={NAME}>{name}</span>
        {context && <span style={CONTEXT}>{context}</span>}
      </span>
      {/* The context stamp: the caption plate on the family's band. */}
      <Badge shape="stamp" size="caption" style={{ ...STAMP, backgroundColor: STAMP_BG[fam] }}>
        {stamp}
      </Badge>
      <span style={SPACER} />
      {units && <div style={UNITS}>{units}</div>}
      {status}
      {downtimeAction && (
        <Button
          variant="ghost"
          size="compact"
          title={downtimeAction.title}
          onClick={() => downtimeAction.onClick()}
        >
          {downtimeAction.label}
        </Button>
      )}
    </>
  )
}
