import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { NUM, PANEL_TITLE, PANEL_TONE, ROW } from './gameChrome'

/**
 * The player's side of propose-and-confirm (D7).
 *
 * The Mediator has said what they think should change; this is where the player
 * decides. Two things about the presentation are load-bearing rather than
 * cosmetic:
 *
 *  - **Before and after are both shown.** The Mediator captured `before` from
 *    their own view at propose time, and it is deliberately not re-read on
 *    apply. If it disagrees with what the player is looking at, that mismatch
 *    is information they should see — the table can then work out who is out of
 *    step — rather than something the UI silently reconciles.
 *  - **Decline is a peer of Apply, not a dismissal.** Declining is a recorded
 *    answer, so it gets equal weight; hiding it behind an X would imply the
 *    only real option is to accept.
 *
 * Nothing here can be auto-applied. There is no server mutation that would let
 * it be, and no timer that would make waiting cost the player anything.
 */
export function ProposalInbox({ gameId }: { gameId: Id<'games'> }) {
  const pending = useQuery(api.proposals.pending, { gameId })
  const apply = useMutation(api.proposals.apply)
  const decline = useMutation(api.proposals.decline)

  if (pending === undefined) return null
  if (pending.length === 0) return null

  const show = (value: unknown): string =>
    value === null || value === undefined ? '—' : String(value)

  return (
    <Card
      headerBg={PANEL_TONE}
      headerContent={<h2 className={PANEL_TITLE}>Awaiting your answer</h2>}
    >
      <div className="flex flex-col gap-3 p-4">
        {pending.map((p) => (
          <div key={p._id} className="flex flex-col gap-2">
            <div className={ROW}>
              <Text as="span">
                {p.entityType} · {p.field}
              </Text>
              <Text as="span" className={NUM}>
                {show(p.before)} → {show(p.after)}
              </Text>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="compact"
                onClick={() => void apply({ proposalId: p._id as Id<'changeLog'> })}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => void decline({ proposalId: p._id as Id<'changeLog'> })}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
