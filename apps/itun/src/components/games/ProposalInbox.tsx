import { Button, toast, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { fieldLabel } from '../../lib/games/proposals'
import { failureMessage } from '../shared/useConfirm'
import { HubSection } from './HubSection'

/**
 * The player's side of propose-and-confirm (ADR-030 §4), on a Game's own page.
 *
 * The Mediator has said what they think should change, and why when they gave
 * a reason (issue 1278); this is where the player decides, against the value they
 * are already looking at on their own sheet.
 *
 * **Decline is a peer of Apply, not a dismissal.** Declining is a recorded
 * answer, so it gets equal weight; hiding it behind an X would imply the only
 * real option is to accept.
 *
 * Nothing here can be auto-applied. There is no server mutation that would let
 * it be, and no timer that would make waiting cost the player anything.
 */

const { borderWidth, color, font, fontSize, radius, space, weight } = tokens

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[10],
}

const ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[10],
  padding: `${space[10]} ${space[12]}`,
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.card,
}

const WHAT: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  minWidth: 0,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  color: color.ink,
  fontVariantNumeric: 'tabular-nums',
}

const HEAD: CSSProperties = { fontWeight: weight.bold, fontSize: fontSize.lede }

const REASON: CSSProperties = { color: color.wkMuted }

const ACTIONS: CSSProperties = { display: 'flex', gap: space[6] }

export function ProposalInbox({ gameId }: { gameId: Id<'games'> }) {
  const pending = useQuery(api.proposals.pending, { gameId })
  const apply = useMutation(api.proposals.apply)
  const decline = useMutation(api.proposals.decline)
  const { canWrite } = useConnection()

  if (pending === undefined) return null
  if (pending.length === 0) return null

  const show = (value: unknown): string =>
    value === null || value === undefined ? '—' : String(value)
  const answer = (write: Promise<unknown>) =>
    void write.catch((err: unknown) =>
      toast.error(failureMessage(err, 'Your answer did not land. Try again.'), {
        id: 'proposal-answer',
      })
    )

  return (
    <HubSection
      id="proposal-inbox-heading"
      title="Awaiting your answer"
      aside={String(pending.length)}
    >
      <ul style={LIST} aria-label="Proposals awaiting your answer">
        {pending.map((p) => {
          const what = `${p.targetName ?? p.entityType} · ${fieldLabel(p.field)} → ${show(p.after)}`
          return (
            <li key={p._id} style={ROW}>
              <span style={WHAT}>
                <span style={HEAD}>{what}</span>
                {p.reason !== null && <span style={REASON}>“{p.reason}”</span>}
              </span>
              <span style={ACTIONS}>
                <Button
                  variant="primary"
                  size="compact"
                  disabled={!canWrite}
                  aria-label={`Apply ${what}`}
                  onClick={() => answer(apply({ proposalId: p._id as Id<'changeLog'> }))}
                >
                  Apply
                </Button>
                <Button
                  variant="default"
                  size="compact"
                  disabled={!canWrite}
                  aria-label={`Decline ${what}`}
                  onClick={() => answer(decline({ proposalId: p._id as Id<'changeLog'> }))}
                >
                  Decline
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
    </HubSection>
  )
}
