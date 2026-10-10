/**
 * Invited — invites addressed to your Discord account, above the shelves
 * (ADR-039; Shelves, board S1).
 *
 * An Organizer invites somebody from Discord with `/su invite @user`, and the
 * bot DMs them a link. A DM is best effort: Discord refuses it when the two do
 * not share a server or the invitee has closed their DMs. This banner is why
 * that failure costs nothing — the invite is addressed to the account, so the
 * addressee finds it here the next time they open the app, wherever the DM
 * went.
 *
 * Each invite is one banner: an INVITED stamp, who invited you to which Game
 * and in what seat, what to bring, and two answers — **Join the Game** redeems
 * it and opens that Game; **Not now** puts it away for this visit and answers
 * nothing, so it is back the next time you open the app, until it expires.
 * Declining for good is the invite link's own page (`InviteScreen`).
 *
 * It shows what the link's landing page shows (the game, who invited you, the
 * seat, what is waiting) and nothing about the crew: membership has not begun.
 *
 * Renders nothing when there is nothing to answer, and nothing outside
 * Connected — like `NewGameControl`, the Convex hooks live in a child mounted
 * only once a provider exists.
 */

import { Badge, Button, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { humanExpiry } from '../../lib/games/inviteExpiry'
import { useShowContainer } from '../container/useShowContainer'
import { failureMessage } from '../shared/useConfirm'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/** One banner: the stamp and the words, then the two answers at the end. */
const BANNER = {
  alignItems: 'center',
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
  padding: `${tokens.space[10]} ${tokens.space[12]}`,
} satisfies CSSProperties

const WORDS = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 20rem',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const SENTENCE = {
  color: tokens.color.ink,
  flex: '1 1 16rem',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  margin: 0,
  minWidth: 0,
} satisfies CSSProperties

const QUIET = { color: tokens.color.wkMuted } satisfies CSSProperties

const ACTIONS = {
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const ERROR = { textAlign: 'left', color: tokens.color.rollCascade } satisfies CSSProperties

/** What to bring, for the seat you are invited to. */
function bring(role: string, grantCount: number): string {
  if (grantCount === 1) return 'A character is waiting for you there.'
  if (grantCount > 1) return `${grantCount} characters are waiting for you there.`
  return role === 'mediator'
    ? 'Bring a crawler from your shelf, or make one when you get there.'
    : 'Bring a pilot from your shelf, or make one when you get there.'
}

function ConnectedInvitations() {
  const invitations = useQuery(api.invites.forMe, {})
  const redeem = useMutation(api.invites.redeem)
  const showContainer = useShowContainer()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // "Not now" answers nothing: it only puts the banner away for this visit.
  const [putAway, setPutAway] = useState<ReadonlySet<string>>(new Set())

  const shown = invitations?.filter((invite) => !putAway.has(invite._id)) ?? []
  if (shown.length === 0) return null

  async function join(code: string) {
    setBusy(code)
    setError(null)
    try {
      const result = await redeem({ code })
      showContainer({ kind: 'game', gameId: result.gameId })
    } catch (err) {
      setError(failureMessage(err, 'That invite could not be accepted. Try again.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Invitations">
      <ul style={LIST}>
        {shown.map((invite) => (
          <li key={invite._id} style={BANNER}>
            <div style={WORDS}>
              <Badge shape="stamp">Invited</Badge>
              <p style={SENTENCE}>
                <strong>{invite.invitedBy}</strong> invited you to{' '}
                <strong>{invite.gameName}</strong>
                {invite.role === 'mediator' ? ' as its Mediator' : ' as a player'}.{' '}
                {bring(invite.role, invite.grantCount)}{' '}
                <span style={QUIET}>({humanExpiry(invite.expiresAt)})</span>
              </p>
            </div>
            <div style={ACTIONS}>
              <Button
                variant="primary"
                size="compact"
                disabled={busy !== null}
                onClick={() => void join(invite.code)}
              >
                Join the Game
              </Button>
              <Button
                size="compact"
                disabled={busy !== null}
                onClick={() => setPutAway((was) => new Set([...was, invite._id]))}
              >
                Not now
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error !== null && (
        <Text variant="hint" role="alert" style={ERROR}>
          {error}
        </Text>
      )}
    </section>
  )
}

/** Invites addressed to you, if any; nothing at all outside Connected mode. */
export function InvitationsForYou() {
  const { mode } = useConnection()
  if (mode !== 'connected') return null
  return <ConnectedInvitations />
}
