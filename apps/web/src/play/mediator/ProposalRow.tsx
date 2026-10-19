/**
 * ProposalRow — one proposal the Mediator sent, as the propose dock, All
 * proposals and the Game page's "Proposals you sent" all show it
 * (docs/architecture/play.md §15; boards M1 and M2).
 *
 * "Judge · HP → 4 · "Ejection burn"", when, and the state in words, on a
 * `FeedLine`. A proposal stores no before (ADR-030 §4, as amended), so a sent
 * row shows only the value it asks for. State is a treatment, never a hue
 * (ruleset §3.3): a Superseded row is struck through, and every state is its word.
 */

import { PROPOSAL_STATE_WORD } from 'game-domain/games/proposals'
import { Eyebrow, FeedLine, FeedTime } from '../../components/index'
import type { SentProposal } from './proposalLine.model'
import { proposalLine } from './proposalLine.model'

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
  return (
    <FeedLine
      struck={proposal.state === 'superseded'}
      end={
        <>
          {showTime && <FeedTime ts={proposal.ts} format="ago" now={now} />}
          <Eyebrow tone="ink">{PROPOSAL_STATE_WORD[proposal.state]}</Eyebrow>
        </>
      }
    >
      {proposalLine(proposal)}
    </FeedLine>
  )
}
