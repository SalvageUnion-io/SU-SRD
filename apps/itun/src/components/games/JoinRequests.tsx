/**
 * JoinRequests — "Asking to join" on a Game's own page, the Organizer's
 * (board M2; docs/architecture/mediator-dashboard.md Q12): everyone who used
 * an approval link and is waiting at the door, with **Let in** and
 * **Decline**.
 *
 * A pending request is not a membership, so nothing of the Game is theirs to
 * read until they are let in; letting them in seats them exactly as a direct
 * redeem would (`invites.decideRequest`). Which pilot a link brings them is
 * P8b: `pendingRequests` does not return the invite's grant names yet.
 */

import { Button, toast, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { ago } from '../mediator/proposalLine'
import { failureMessage } from '../shared/useConfirm'
import { HubSection } from './HubSection'
import { HUB_COPY } from './hubStyles'

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

const WHO: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[2], minWidth: 0 }

const NAME: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontWeight: weight.bold,
  color: color.ink,
}

const META: CSSProperties = { fontFamily: font.body, fontSize: fontSize.sm, color: color.wkMuted }

const ACTIONS: CSSProperties = { display: 'flex', gap: space[6] }

export function JoinRequests({ gameId }: { gameId: Id<'games'> }) {
  const requests = useQuery(api.invites.pendingRequests, { gameId })
  const decide = useMutation(api.invites.decideRequest)
  const { canWrite } = useConnection()
  const now = Date.now()

  const answer = (requestId: Id<'joinRequests'>, approve: boolean) =>
    void decide({ requestId, approve }).catch((err: unknown) =>
      toast.error(failureMessage(err, 'That answer did not land. Try again.'), {
        id: 'join-request',
      })
    )

  return (
    <HubSection
      id="asking-to-join-heading"
      title="Asking to join"
      aside={requests === undefined ? undefined : String(requests.length)}
    >
      {requests !== undefined && requests.length === 0 ? (
        <p style={HUB_COPY}>Nobody is waiting. An approval link sends people here first.</p>
      ) : (
        <ul style={LIST} aria-label="Asking to join">
          {requests?.map((request) => (
            <li key={request._id} style={ROW}>
              <span style={WHO}>
                <span style={NAME}>{request.displayName}</span>
                <span style={META}>
                  {[
                    `${request.role === 'mediator' ? 'Mediator' : 'Player'} seat link`,
                    request.inviteLabel,
                    `asked ${ago(request.requestedAt, now)}`,
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                </span>
              </span>
              <span style={ACTIONS}>
                <Button
                  variant="primary"
                  size="compact"
                  disabled={!canWrite}
                  aria-label={`Let ${request.displayName} in`}
                  onClick={() => answer(request._id, true)}
                >
                  Let in
                </Button>
                <Button
                  variant="default"
                  size="compact"
                  disabled={!canWrite}
                  aria-label={`Decline ${request.displayName}`}
                  onClick={() => answer(request._id, false)}
                >
                  Decline
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </HubSection>
  )
}
