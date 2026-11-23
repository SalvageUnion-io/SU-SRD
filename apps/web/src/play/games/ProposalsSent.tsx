/**
 * ProposalsSent — "Proposals you sent" on a Game's own page, the Mediator's
 * (docs/architecture/play.md §15): every Mediator
 * proposal in the Game with its state, newest first, twenty at a time. A
 * Mediator handed the table inherits what is still pending, and may withdraw
 * one before it is answered (r2 C7).
 *
 * The Mediator never edits a player's sheet (ADR-030 §4); this is the record
 * of what they asked, and the players' answers. Until they have sent one there
 * is no section: Mediate, in Play, is where a proposal starts.
 */

import { PROPOSALS_PAGE } from 'game-domain/games/proposals'
import { useState } from 'react'
import { SlabSection } from '../../components/index'
import { playGamesCopy } from '../../messages/play-games'
import { useSync } from '../../replica/syncContext'
import { useTableRead } from '../../replica/useTable'
import { ProposalsList } from '../mediator/ProposalsList'
import { useWithdrawProposal } from '../mediator/useWithdrawProposal'
import { HUB_BODY } from './hubStyles.model'
import { lastSession } from './lastSession.model'
import { currentProposals } from './proposalsSent.model'

export function ProposalsSent({ gameId }: { gameId: string }) {
  const [limit, setLimit] = useState(PROPOSALS_PAGE)
  const all = useTableRead('ops.sent', { gameId, limit })
  const events = useTableRead('changeLog.events', { gameId })
  const withdraw = useWithdrawProposal(gameId)
  const { canWrite } = useSync()
  const sent =
    all === undefined || events === undefined
      ? undefined
      : currentProposals(all, lastSession(events))
  if (sent !== undefined && sent.length === 0) return null
  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="proposals-sent-heading"
      title={playGamesCopy('proposalsYouSent')}
    >
      <ProposalsList
        proposals={sent ?? null}
        limit={limit}
        now={Date.now()}
        onMore={() => setLimit((n) => n + PROPOSALS_PAGE)}
        onWithdraw={canWrite ? withdraw : undefined}
        empty={playGamesCopy('nothingSentYetProposeA')}
      />
    </SlabSection>
  )
}
