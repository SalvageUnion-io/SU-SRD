/**
 * ProposalsList — every Mediator proposal in the Game, newest first, twenty at
 * a time (docs/architecture/mediator-dashboard.md Q8): the Mediator
 * Dashboard's Proposals tab and the Game page's "Proposals you sent" (board
 * M2). Each row is a `ProposalRow`: target, field, the value asked for, the
 * reason, when, and the state in words.
 *
 * Presentational: `proposals.sent` is read with a `limit` the caller raises by
 * twenty when **Show more** is pressed.
 */

import { Button, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { PROPOSALS_PAGE } from '../../lib/games/proposals'
import { MUTED } from './mediatorStyles'
import { ProposalRow } from './ProposalRow'
import type { SentProposal } from './proposalLine'
import { PROPOSAL_LIST } from './proposalLine'

const { space } = tokens

const MORE: CSSProperties = { alignSelf: 'flex-start', marginTop: space[8] }

const COLUMN: CSSProperties = { display: 'flex', flexDirection: 'column' }

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
  if (proposals.length === 0) return <p style={MUTED}>{empty}</p>
  return (
    <div style={COLUMN}>
      <ul style={PROPOSAL_LIST} aria-label="Proposals">
        {proposals.map((p) => (
          <ProposalRow key={p._id} proposal={p} now={now} />
        ))}
      </ul>
      {proposals.length >= limit && (
        <Button variant="ghost" size="compact" style={MORE} onClick={onMore}>
          Show {PROPOSALS_PAGE} more
        </Button>
      )}
    </div>
  )
}
