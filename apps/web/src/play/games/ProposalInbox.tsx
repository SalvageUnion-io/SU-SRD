import { useMutation, useQuery } from 'convex/react'
import { fieldLabel } from 'game-domain/games/proposals'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Button, FeedLine, FeedList, SlabSection, tokens } from '../../components/index'
import { useServerAction } from '../../lib/connection/useServerAction'
import { playGamesCopy } from '../../messages/play-games'
import { useSync } from '../../replica/syncContext'
import { HUB_BODY } from './hubStyles.model'

/**
 * The player's side of propose-and-confirm (ADR-030 §4), on a Game's own page.
 *
 * The Mediator has said what they think should change, and why when they gave
 * a reason; this is where the player decides, against the value they
 * are already looking at on their own sheet.
 *
 * **Decline is a peer of Apply, not a dismissal.** Declining is a recorded
 * answer, so it gets equal weight; hiding it behind an X would imply the only
 * real option is to accept.
 *
 * Nothing here can be auto-applied. There is no server mutation that would let
 * it be, and no timer that would make waiting cost the player anything.
 */

const { color, space, weight } = tokens

const HEAD = { display: 'block', fontWeight: weight.bold } satisfies CSSProperties

const REASON = { display: 'block', color: color.wkMuted } satisfies CSSProperties

const ACTIONS = { display: 'flex', gap: space[6] } satisfies CSSProperties

export function ProposalInbox({ gameId }: { gameId: Id<'games'> }) {
  const pending = useQuery(api.proposals.pending, { gameId })
  const apply = useMutation(api.proposals.apply)
  const decline = useMutation(api.proposals.decline)
  const { canWrite } = useSync()
  const reply = useServerAction((send: () => Promise<unknown>) => send(), {
    failure: 'Your answer did not land. Try again.',
    toastId: 'proposal-answer',
  })

  if (pending === undefined) return null
  if (pending.length === 0) return null

  const show = (value: unknown): string =>
    value === null || value === undefined ? '—' : String(value)
  const answer = (send: () => Promise<unknown>) => void reply.run(send)

  return (
    <SlabSection
      as="h2"
      bodyStyle={HUB_BODY}
      id="proposal-inbox-heading"
      title={playGamesCopy('awaitingYourAnswer')}
    >
      <FeedList label={playGamesCopy('proposalsAwaitingYourAnswer')}>
        {pending.map((p) => {
          const what = `${p.targetName ?? p.entityType} · ${fieldLabel(p.field)} → ${show(p.after)}`
          return (
            <FeedLine
              key={p._id}
              end={
                <span style={ACTIONS}>
                  <Button
                    variant="primary"
                    size="compact"
                    disabled={!canWrite}
                    aria-label={playGamesCopy('apply2', { what })}
                    onClick={() => answer(() => apply({ proposalId: p._id as Id<'changeLog'> }))}
                  >
                    {playGamesCopy('apply')}
                  </Button>
                  <Button
                    variant="default"
                    size="compact"
                    disabled={!canWrite}
                    aria-label={playGamesCopy('decline2', { what })}
                    onClick={() => answer(() => decline({ proposalId: p._id as Id<'changeLog'> }))}
                  >
                    {playGamesCopy('decline')}
                  </Button>
                </span>
              }
            >
              <span style={HEAD}>{what}</span>
              {p.reason !== null && <span style={REASON}>“{p.reason}”</span>}
            </FeedLine>
          )
        })}
      </FeedList>
    </SlabSection>
  )
}
