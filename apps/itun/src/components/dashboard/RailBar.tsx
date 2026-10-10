/**
 * RailBar — the Dashboard's top rail (boards D1–D3, issue 1255): the way back
 * to the Game, the SU mark, the pilot this Dashboard plays, a stamp for where
 * they are ("Boarded · Scrapper", "On foot", "Downtime · Step 3 of 10"), the
 * Game it saves to, then — in Downtime — the pilot and mech as compact links
 * with their pips (`RailUnit`), whether play is being saved (`status`, the
 * app's `SavedIndicator`), and the Mediator's Start or End Downtime.
 *
 * Presentational only — the `.pc-rail` region wrapper (grid area + flex row +
 * forward border) is supplied by DashboardGrid's rail slot, and the app
 * injects its own router link via `returnControl` (component-lib stays
 * routing-agnostic).
 */

import { Badge, Button, tokens } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'

export type RailFam = 'mech' | 'pilot' | 'crawler'

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
} satisfies CSSProperties

const CONTEXT = {
  color: tokens.color.ink75,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.caption,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const UNITS = {
  alignItems: 'center',
  display: 'flex',
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
      <img src="/logos/su-cargo-dark.svg" alt="" width={24} height={24} style={MARK} />
      <span style={NAME}>{name}</span>
      <Badge
        shape="stamp"
        className="px-[9px] py-[5px] text-caption text-paper"
        style={{ backgroundColor: STAMP_BG[fam] }}
      >
        {stamp}
      </Badge>
      {context && <span style={CONTEXT}>{context}</span>}
      <span className="flex-1" />
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
