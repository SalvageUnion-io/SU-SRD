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
} from '../../../ui/design/tokens'
import { buttonVariants } from '../../../ui/index'
import { AppLink } from '../shared/AppLink'
import type { AlertLine } from './useGameFeed'

const STRIP = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: space[10],
  minHeight: '36px',
  padding: `${space[4]} ${space[12]}`,
  borderTop: `${borderWidth.chrome} solid ${color.ink20}`,
} satisfies CSSProperties

const LABEL = {
  flex: '0 0 auto',
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
} satisfies CSSProperties

const ALERT = {
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
} satisfies CSSProperties

const SPACER = { flex: 1 } satisfies CSSProperties

const QUIET = { ...LABEL, textTransform: 'none', letterSpacing: 'normal' } satisfies CSSProperties

/**
 * The phone menu's Game box (ADR-045 D9): one row each, so a long Game name
 * wraps instead of pushing the Inbox past the screen's edge. The box draws
 * its own frame, so no rule above.
 */
const STACKED = {
  ...STRIP,
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: space[4],
  padding: 0,
  borderTop: 0,
} satisfies CSSProperties

const STACKED_LABEL = {
  ...LABEL,
  flex: '0 1 auto',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
} satisfies CSSProperties

const STACKED_ALERT = { ...ALERT, maxWidth: '100%' } satisfies CSSProperties

function proposals(n: number): string {
  return n === 1 ? '1 proposal' : `${n} proposals`
}

export function DashboardStrip({
  gameName,
  gameHref,
  alerts,
  inbox,
  stacked = false,
}: {
  gameName: string | null
  /** The Game's hub, where the inbox is answered; null before it is known. */
  gameHref: string | null
  /** Newest first: the strip shows the first. */
  alerts: readonly AlertLine[]
  inbox: number
  /** One row each — the Game, the alert, the inbox — for the phone menu. */
  stacked?: boolean
}) {
  const latest = alerts[0]
  return (
    <section aria-label="Table" style={stacked ? STACKED : STRIP}>
      {gameName ? <span style={stacked ? STACKED_LABEL : LABEL}>{gameName}</span> : null}
      {latest ? (
        <span role="status" style={stacked ? STACKED_ALERT : ALERT} title={latest.message}>
          Mediator: {latest.message}
        </span>
      ) : null}
      {stacked ? null : <span style={SPACER} />}
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
