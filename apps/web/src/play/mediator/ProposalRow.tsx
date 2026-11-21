/**
 * ProposalRow — one proposal the Mediator sent, as the propose dock, All
 * proposals and the Game page's "Proposals you sent" all show it
 * (docs/architecture/play.md §15).
 *
 * "Judge · HP → 4 · "Ejection burn"", when, and the state in words, on a
 * `FeedLine`. A proposal stores no before (ADR-030 §4, as amended), so a sent
 * row shows only the value it asks for. State is a treatment, never a hue
 * (ruleset §3.3): a Superseded or Withdrawn row is struck through, and every
 * state is its word. A Pending row offers Withdraw (r2 C7) where the caller
 * may take it back.
 */

import { PROPOSAL_STATE_WORD } from 'game-domain/games/proposals'
import { FeedLine, FeedTime } from '../../components/app'
import { Button, Eyebrow } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import type { SentProposal } from './proposalLine.model'
import { proposalLine } from './proposalLine.model'

export function ProposalRow({
  proposal,
  now,
  showTime = true,
  onWithdraw,
}: {
  proposal: SentProposal
  /** The clock the "ago" is read against (the caller's, so a list agrees). */
  now: number
  /** The dock is narrow: it leaves the time out. */
  showTime?: boolean
  /** Take a pending proposal back; absent where writes cannot go. */
  onWithdraw?: ((opId: string) => void) | undefined
}) {
  const line = proposalLine(proposal)
  return (
    <FeedLine
      struck={proposal.state === 'superseded' || proposal.state === 'withdrawn'}
      end={
        <>
          {showTime && <FeedTime ts={proposal.ts} format="ago" now={now} />}
          <Eyebrow tone="ink">{PROPOSAL_STATE_WORD[proposal.state]}</Eyebrow>
          {proposal.state === 'proposed' && onWithdraw ? (
            <Button
              size="mini"
              aria-label={mediatorCopy('withdrawWhat', { what: line })}
              onClick={() => onWithdraw(proposal._id)}
            >
              {mediatorCopy('withdraw')}
            </Button>
          ) : null}
        </>
      }
    >
      {line}
    </FeedLine>
  )
}
