/**
 * ProposalRow — one proposal the Mediator sent, as the propose dock, the
 * Proposals tab and the Game page's "Proposals you sent" all show it
 * (docs/architecture/mediator-dashboard.md Q8; boards M1 and M2).
 *
 * "Judge · HP → 4 · "Ejection burn"", when, and the state in words. A proposal
 * stores no before (ADR-030 §4, as amended), so a sent row shows only
 * the value it asks for. State is a treatment, never a hue (ruleset §3.3): a
 * Superseded row is struck through, and every state is its word.
 */

import { PROPOSAL_STATE_WORD } from 'cantina-domain/games/proposals'
import type { CSSProperties } from 'react'
import { tokens } from '../index'
import { NUMBERS } from './mediatorStyles.model'
import type { SentProposal } from './proposalLine.model'
import { ago, proposalLine } from './proposalLine.model'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

const ROW = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  alignItems: 'center',
  gap: space[12],
  padding: `${space[8]} ${space[10]}`,
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink20}`,
  borderRadius: radius.card,
} satisfies CSSProperties

const WHAT = {
  ...NUMBERS,
  minWidth: 0,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const WHEN = {
  ...NUMBERS,
  fontFamily: font.body,
  fontSize: fontSize.note,
  color: color.ink75,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const STATE = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

export function ProposalRow({
  proposal,
  now,
  showTime = true,
}: {
  proposal: SentProposal
  /** The clock the "ago" is read against (the caller's, so a list agrees). */
  now: number
  /** The dock is narrow: it leaves the time out. */
  showTime?: boolean
}) {
  const superseded = proposal.state === 'superseded'
  return (
    <li style={showTime ? ROW : { ...ROW, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
      <span style={superseded ? { ...WHAT, textDecoration: 'line-through' } : WHAT}>
        {proposalLine(proposal)}
      </span>
      {showTime && <span style={WHEN}>{ago(proposal.ts, now)}</span>}
      <span style={STATE}>{PROPOSAL_STATE_WORD[proposal.state]}</span>
    </li>
  )
}
