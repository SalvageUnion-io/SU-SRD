/**
 * ProposalsSent — "Proposals you sent" on a Game's own page, the Mediator's
 * (board M2; docs/architecture/mediator-dashboard.md Q8): every Mediator
 * proposal in the Game with its state, newest first, twenty at a time. A
 * Mediator handed the table inherits what is still pending.
 *
 * The Mediator never edits a player's sheet (ADR-030 §4); this is the record
 * of what they asked, and the players' answers.
 */

import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PROPOSALS_PAGE } from '../../lib/games/proposals'
import { ProposalsList } from '../mediator/ProposalsList'
import { HubSection } from './HubSection'
import { HUB_COPY } from './hubStyles'

export function ProposalsSent({ gameId }: { gameId: Id<'games'> }) {
  const [limit, setLimit] = useState(PROPOSALS_PAGE)
  const sent = useQuery(api.proposals.sent, { gameId, limit })
  return (
    <HubSection id="proposals-sent-heading" title="Proposals you sent">
      <p style={HUB_COPY}>
        You never edit a player&rsquo;s sheet. You propose; they apply or decline. A newer proposal
        on the same field supersedes the old one.
      </p>
      <ProposalsList
        proposals={sent ?? null}
        limit={limit}
        now={Date.now()}
        onMore={() => setLimit((n) => n + PROPOSALS_PAGE)}
        empty="Nothing sent yet. Propose a change from the Mediator dashboard."
      />
    </HubSection>
  )
}
