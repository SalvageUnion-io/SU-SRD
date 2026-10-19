/**
 * ProposalsList — every Mediator proposal in the Game, newest first, twenty at
 * a time (docs/architecture/play.md §15): Play's All proposals
 * and the Game page's "Proposals you sent" (board M2). Each row is a `ProposalRow`: target, field, the value asked for, the
 * reason, when, and the state in words.
 *
 * Presentational: `proposals.sent` is read with a `limit` the caller raises by
 * twenty when **Show more** is pressed.
 */

import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import type { CSSProperties } from 'react'
import { Button, EmptyState, FeedList, tokens } from '../../components/index'
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
  empty = 'No proposals yet. Pick a seat, then propose the change you think it needs.',
}: {
  /** Null while the first answer is on its way. */
  proposals: readonly SentProposal[] | null
  /** How many were asked for: a full page means there may be more. */
  limit: number
  now: number
  onMore: () => void
  empty?: string
}) {
  if (proposals === null) return <p style={MUTED}>Proposals are on their way.</p>
  if (proposals.length === 0) return <EmptyState variant="quiet" body={empty} />
  return (
    <div style={COLUMN}>
      <FeedList label="Proposals">
        {proposals.map((p) => (
          <ProposalRow key={p._id} proposal={p} now={now} />
        ))}
      </FeedList>
      {proposals.length >= limit && (
        <Button variant="ghost" size="compact" style={MORE} onClick={onMore}>
          Show {PROPOSALS_PAGE} more
        </Button>
      )}
    </div>
  )
}
