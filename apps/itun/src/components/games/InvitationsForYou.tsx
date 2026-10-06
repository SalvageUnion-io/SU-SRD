/**
 * Invitations — invites addressed to your Discord account, on the hub
 * (ADR-038).
 *
 * An Organizer invites somebody from Discord with `/su invite @user`, and the
 * bot DMs them a link. A DM is best effort: Discord refuses it when the two do
 * not share a server or the invitee has closed their DMs. This card is why that
 * failure costs nothing — the invite is addressed to the account, so the
 * addressee finds it here the next time they open the app, wherever the DM
 * went.
 *
 * It shows what the link's landing page shows (the game, who invited you, the
 * seat, what is waiting) and nothing about the crew: membership has not begun.
 *
 * Renders nothing when there is nothing to answer, and nothing outside
 * Connected — like `NewGameControl`, the Convex hooks live in a child mounted
 * only once a provider exists.
 */

import { Badge, Button, Row, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { setActiveContainer } from '../../stores/activeContainerStore'
import { failureMessage } from '../shared/useConfirm'
import { GamePanel } from './GamePanel'

const PLACE = { marginTop: tokens.space[20] } satisfies CSSProperties

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const ERROR = { textAlign: 'left', color: tokens.color.rollCascade } satisfies CSSProperties

function daysLeft(expiresAt: number | null): string | null {
  if (expiresAt === null) return null
  const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
  return days <= 1 ? 'expires today' : `${days} days left`
}

function ConnectedInvitations() {
  const invitations = useQuery(api.invites.forMe, {})
  const redeem = useMutation(api.invites.redeem)
  const decline = useMutation(api.invites.decline)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (invitations === undefined || invitations.length === 0) return null

  async function act(code: string, work: () => Promise<void>, failure: string) {
    setBusy(code)
    setError(null)
    try {
      await work()
    } catch (err) {
      setError(failureMessage(err, failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={PLACE}>
      <GamePanel title="Invitations">
        <div style={LIST}>
          {invitations.map((invite) => (
            <Row
              key={invite._id}
              wrap
              name={`${invite.invitedBy} invited you to ${invite.gameName}`}
              meta={[
                invite.grantCount === 0
                  ? null
                  : invite.grantCount === 1
                    ? 'a character is waiting for you'
                    : `${invite.grantCount} characters are waiting for you`,
                daysLeft(invite.expiresAt),
              ]
                .filter((segment) => segment !== null)
                .join(' · ')}
              actions={
                <>
                  {invite.role === 'mediator' && (
                    <Badge surface="tone" tone="game">
                      Mediator seat
                    </Badge>
                  )}
                  <Button
                    variant="primary"
                    size="mini"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        invite.code,
                        async () => {
                          const result = await redeem({ code: invite.code })
                          setActiveContainer({ kind: 'game', gameId: result.gameId })
                        },
                        'That invite could not be accepted. Try again.'
                      )
                    }
                  >
                    Join
                  </Button>
                  <Button
                    variant="ghost"
                    size="mini"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(
                        invite.code,
                        async () => {
                          await decline({ code: invite.code })
                        },
                        'That invite could not be declined. Try again.'
                      )
                    }
                  >
                    Decline
                  </Button>
                </>
              }
            />
          ))}
          <Text variant="hint" style={{ textAlign: 'left' }}>
            Everyone at a table can read each other&rsquo;s sheets.
          </Text>
          {error !== null && (
            <Text variant="hint" role="alert" style={ERROR}>
              {error}
            </Text>
          )}
        </div>
      </GamePanel>
    </div>
  )
}

/** Invites addressed to you, if any; nothing at all outside Connected mode. */
export function InvitationsForYou() {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedInvitations />
}
