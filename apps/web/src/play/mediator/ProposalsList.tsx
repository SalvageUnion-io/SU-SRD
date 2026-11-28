/**
 * ProposalsList — every Mediator proposal in the Game, newest first, twenty at
 * a time (docs/architecture/play.md §15): Play's All proposals
 * and the Game page's "Proposals you sent". Each row is a `ProposalRow`:
 * target, field, the value asked for, the
 * reason, when, and the state in words.
 *
 * Presentational: `ops.sent` is read with a `limit` the caller raises by
 * twenty when **Show more** is pressed.
 */

import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { CSSProperties } from 'react'
import { FeedList } from '../../components/app'
import { Button, EmptyState, tokens } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
import { MUTED } from './mediatorStyles.model'
import { ProposalRow } from './ProposalRow'
import type { SentProposal } from './proposalLine.model'

const { space } = tokens

const MORE = { alignSelf: 'flex-start', marginTop: space[8] } satisfies CSSProperties

const COLUMN = { display: 'flex', flexDirection: 'column' } satisfies CSSProperties

export function ProposalsList({
  proposals,
  limit,
  now,
  onMore,
  onWithdraw,
  empty = mediatorCopy('noProposalsYet'),
}: {
  /** Null while the first answer is on its way. */
  proposals: readonly SentProposal[] | null
  /** How many were asked for: a full page means there may be more. */
  limit: number
  now: number
  onMore: () => void
  /** Withdraw a pending one (r2 C7); absent where writes cannot go. */
  onWithdraw?: ((opId: string) => void) | undefined
  empty?: string
}) {
  if (proposals === null) return <p style={MUTED}>{mediatorCopy('proposalsAreOnTheirWay')}</p>
  if (proposals.length === 0) return <EmptyState variant="quiet" body={empty} />
  return (
    <div style={COLUMN}>
      <FeedList label={mediatorCopy('proposals')}>
        {proposals.map((p) => (
          <ProposalRow key={p._id} proposal={p} now={now} onWithdraw={onWithdraw} />
        ))}
      </FeedList>
      {proposals.length >= limit && (
        <Button variant="ghost" size="compact" style={MORE} onClick={onMore}>
          {mediatorCopy('showMore', { proposalsPage: PROPOSALS_PAGE })}
        </Button>
      )}
    </div>
  )
}
