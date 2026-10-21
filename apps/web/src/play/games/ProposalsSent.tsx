/**
 * ProposalsSent — "Proposals you sent" on a Game's own page, the Mediator's
 * (docs/architecture/play.md §15): every Mediator
 * proposal in the Game with its state, newest first, twenty at a time. A
 * Mediator handed the table inherits what is still pending.
 *
 * The Mediator never edits a player's sheet (ADR-030 §4); this is the record
 * of what they asked, and the players' answers.
 */

import { useQuery } from 'convex/react'
import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SlabSection } from '../../components/index'
import { ProposalsList } from '../mediator/ProposalsList'
import { HUB_BODY } from './hubStyles.model'

export function ProposalsSent({ gameId }: { gameId: Id<'games'> }) {
  const [limit, setLimit] = useState(PROPOSALS_PAGE)
  const sent = useQuery(api.proposals.sent, { gameId, limit })
  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="proposals-sent-heading"
      title="Proposals you sent"
    >
      <ProposalsList
        proposals={sent ?? null}
        limit={limit}
        now={Date.now()}
        onMore={() => setLimit((n) => n + PROPOSALS_PAGE)}
        empty="Nothing sent yet. Propose a change from Mediate, in Play."
      />
    </SlabSection>
  )
}
