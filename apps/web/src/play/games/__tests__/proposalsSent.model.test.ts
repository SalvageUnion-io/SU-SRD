import { describe, expect, test } from 'bun:test'
import type { SentProposal } from '../../mediator/proposalLine.model'
import { currentProposals } from '../proposalsSent.model'

const sent = (id: string, ts: number, state: SentProposal['state']) =>
  ({ _id: id, ts, state }) as SentProposal

/** r8 B8 (MD8-23): last session's answered proposals leave the Game page. */
describe('the proposals the Game page lists', () => {
  const OLD = sent('old', 100, 'applied')
  const WAITING = sent('waiting', 100, 'proposed')
  const NEW = sent('new', 300, 'declined')

  test('after a session ends, only what awaits an answer and what came after stay', () => {
    expect(
      currentProposals([NEW, WAITING, OLD], { startedAt: 50, endedAt: 200 }).map((p) => p._id)
    ).toEqual(['new', 'waiting'])
  })

  test('while a session runs, its answered ones stay', () => {
    expect(
      currentProposals([NEW, WAITING, OLD], { startedAt: 100, endedAt: null }).map((p) => p._id)
    ).toEqual(['new', 'waiting', 'old'])
  })

  test('with no session on record, every one stays', () => {
    expect(currentProposals([OLD], null)).toEqual([OLD])
  })
})
