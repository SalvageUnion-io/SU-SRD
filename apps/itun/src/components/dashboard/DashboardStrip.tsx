/**
 * DashboardStrip — the strip along the bottom of the display
 * (docs/architecture/dashboard.md §2): the Mediator's latest
 * alert and how many proposals wait for this player's answer.
 *
 * Crew status is not here; it is the Crew tab's. The count links to the
 * Game, where the proposal inbox is answered: a proposal is a decision with a
 * before and an after to read, which a strip has no room to show.
 *
 * Presentational: `useGameFeed` reads the alerts and the count.
 */

import { buttonVariants } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { AppLink } from '../shared/AppLink'
import type { AlertLine } from './useGameFeed'

const STRIP: CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: space[10],
  minHeight: '36px',
  padding: `${space[4]} ${space[12]}`,
  borderTop: `${borderWidth.chrome} solid ${color.ink20}`,
}

const LABEL: CSSProperties = {
  flex: '0 0 auto',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
}

const ALERT: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  padding: `1px ${space[8]}`,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
  fontFamily: font.body,
  fontSize: fontSize.note,
  color: color.ink,
}

const SPACER: CSSProperties = { flex: 1 }

const QUIET: CSSProperties = { ...LABEL, textTransform: 'none', letterSpacing: 'normal' }

function proposals(n: number): string {
  return n === 1 ? '1 proposal' : `${n} proposals`
}

export function DashboardStrip({
  gameName,
  gameHref,
  alerts,
  inbox,
}: {
  gameName: string | null
  /** The Game's hub, where the inbox is answered; null before it is known. */
  gameHref: string | null
  /** Newest first: the strip shows the first. */
  alerts: readonly AlertLine[]
  inbox: number
}) {
  const latest = alerts[0]
  return (
    <section aria-label="Table" style={STRIP}>
      {gameName ? <span style={LABEL}>{gameName}</span> : null}
      {latest ? (
        <span role="status" style={ALERT} title={latest.message}>
          Mediator: {latest.message}
        </span>
      ) : null}
      <span style={SPACER} />
      {inbox > 0 && gameHref ? (
        <AppLink href={gameHref} className={buttonVariants({ variant: 'ghost', size: 'compact' })}>
          Inbox · {proposals(inbox)}
        </AppLink>
      ) : (
        <span style={QUIET}>No proposals waiting</span>
      )}
    </section>
  )
}
