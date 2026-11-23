/**
 * What "Proposals you sent" on a Game's page holds (r8 B8, MD8-23), pure:
 * the proposals still awaiting their answer, and the ones sent since the
 * last group session ended (while one runs, since it started). An answered
 * one from a session that has ended leaves the page; Mediate's All proposals
 * keeps the whole record.
 */

import type { SentProposal } from '../mediator/proposalLine.model'
import type { SessionRecord } from './lastSession.model'

export function currentProposals(
  sent: readonly SentProposal[],
  record: Pick<SessionRecord, 'startedAt' | 'endedAt'> | null
): SentProposal[] {
  if (record === null) return [...sent]
  const since = record.endedAt ?? record.startedAt
  return sent.filter((p) => p.state === 'proposed' || p.ts >= since)
}
