import { Badge, Button, Card, Row } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * The player's side of propose-and-confirm (ADR-030 §4).
 *
 * The Mediator has said what they think should change; this is where the player
 * decides, against the value they are already looking at on their own sheet.
 *
 * **Decline is a peer of Apply, not a dismissal.** Declining is a recorded
 * answer, so it gets equal weight; hiding it behind an X would imply the only
 * real option is to accept.
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
      headerBg="bg-ink"
      headerContent={
        <Badge shape="stamp" as="h3" size="full">
          Awaiting your answer
        </Badge>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {pending.map((p) => (
          <Row
            key={p._id}
            wrap
            name={`${p.entityType} · ${p.field}`}
            meta={<span className="font-cond tabular-nums">→ {show(p.after)}</span>}
            actions={
              <>
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
              </>
            }
          />
        ))}
      </div>
    </Card>
  )
}
