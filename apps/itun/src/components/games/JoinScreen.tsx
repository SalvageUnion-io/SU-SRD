import { useState } from 'react'
import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'

import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { SignInControl } from '../account/SignInControl'
import { AppLink } from '../shared/AppLink'
import { PAGE, STAMP, TITLE } from './gameChrome'

/**
 * `/join/$code` — the link half of an invite.
 *
 * Signed-out is the **expected** state here, not an edge case: the whole point
 * of a link is that you can hand it to someone who has no account yet. So the
 * page describes the invitation *before* asking for a sign-in, and a dead code
 * says so without ever prompting one — being asked to authenticate only to find
 * out the code expired is the worst version of this screen.
 *
 * The code lives in the URL rather than in `sessionStorage`, so it survives the
 * OAuth round-trip and still works when pasted into a different browser.
 */

/** What the invite is worth, phrased for the person holding it. */
const DEAD_CODE_COPY = {
  revoked: 'That invite has been revoked.',
  expired: 'That invite has expired.',
  exhausted: 'That invite has already been used.',
} as const

function ConnectedJoin({ code }: { code: string }) {
  const preview = useQuery(api.invites.preview, { code })
  const redeem = useMutation(api.invites.redeem)
  const navigate = useNavigate()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (preview === undefined) return <Text>Checking that invite…</Text>

  if (preview === null) {
    return (
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Text>That invite code is not valid.</Text>
          <Text variant="hint" className="text-left">
            Check it for a typo, or ask whoever invited you for a fresh one.
          </Text>
          <div>
            <AppLink href="/games">Go to your games</AppLink>
          </div>
        </div>
      </Card>
    )
  }

  if (preview.status !== 'active') {
    return (
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Text>{DEAD_CODE_COPY[preview.status]}</Text>
          <Text variant="hint" className="text-left">
            Ask {preview.invitedBy} for a fresh code.
          </Text>
          <div>
            <AppLink href="/games">Go to your games</AppLink>
          </div>
        </div>
      </Card>
    )
  }

  if (pending) {
    return (
      <Card>
        <div className="flex flex-col gap-3 p-4">
          <Text>Asked to join {preview.gameName}.</Text>
          <Text variant="hint" className="text-left">
            {preview.invitedBy} has to approve you before you can see the table. You can close this
            page — it will show up in your games once they do.
          </Text>
          <div>
            <AppLink href="/games">Go to your games</AppLink>
          </div>
        </div>
      </Card>
    )
  }

  const accept = () => {
    setError(null)
    void redeem({ code })
      .then((result) => {
        if (result.kind === 'pending') {
          setPending(true)
          return
        }
        void navigate({ to: '/games/$gameId', params: { gameId: result.gameId } })
      })
      .catch((err: Error) => setError(err.message))
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <span className={STAMP}>You have been invited</span>
        <Text>
          {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>
          {preview.role === 'mediator' ? ' as its Mediator' : ''}.
        </Text>
        {preview.grantCount > 0 && (
          <Text variant="hint" className="text-left">
            {preview.grantCount === 1
              ? 'A character is waiting for you.'
              : `${preview.grantCount} characters are waiting for you.`}
          </Text>
        )}
        <Text variant="hint" className="text-left">
          {preview.requiresApproval
            ? 'Joining asks the organizer to let you in.'
            : 'Everyone at a table can read each other’s sheets.'}
        </Text>
        <div>
          <Button variant="primary" size="compact" onClick={accept}>
            {preview.requiresApproval ? 'Ask to join' : 'Join this game'}
          </Button>
        </div>
        {error !== null && (
          <Text variant="hint" className="text-left text-[var(--color-roll-cascade)]">
            {error}
          </Text>
        )}
      </div>
    </Card>
  )
}

/**
 * The signed-out view. It still previews the invite, because the point of a
 * link is that it means something before you have an account — `preview` is
 * unauthenticated for exactly this.
 */
function SignedOutJoin({ code }: { code: string }) {
  const preview = useQuery(api.invites.preview, { code })

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        {preview === undefined && <Text>Checking that invite…</Text>}
        {preview === null && <Text>That invite code is not valid.</Text>}
        {preview != null && preview.status !== 'active' && (
          <Text>{DEAD_CODE_COPY[preview.status]}</Text>
        )}
        {preview != null && preview.status === 'active' && (
          <>
            <span className={STAMP}>You have been invited</span>
            <Text>
              {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>
              {preview.role === 'mediator' ? ' as its Mediator' : ''}.
            </Text>
            <Text variant="hint" className="text-left">
              Sign in to accept. Playing alone never needs an account — signing in is what lets you
              share a table.
            </Text>
            <div>
              <SignInControl />
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export function JoinScreen({ code }: { code: string }) {
  const { mode } = useConnection()

  const body = () => {
    if (!isConvexConfigured) {
      return (
        <Card>
          <div className="p-4">
            <Text>
              This build has no account service configured, so invite links cannot be accepted here.
            </Text>
          </div>
        </Card>
      )
    }
    if (mode === 'connected') return <ConnectedJoin code={code} />
    if (mode === 'disconnected') {
      return (
        <Card>
          <div className="p-4">
            <Text>You are offline, so this invite cannot be checked right now.</Text>
          </div>
        </Card>
      )
    }
    return <SignedOutJoin code={code} />
  }

  return (
    <main className={PAGE}>
      <Text as="h1" className={TITLE}>
        Join a game
      </Text>
      {/* The page shell is the full-width one every Game surface now uses, but
          the form inside is capped: a Game screen is wide because it lists a
          crew, and this one holds a six-character code. Stretching the card to
          1440px would make the shells match by making the content worse. */}
      <div className="w-full max-w-xl">{body()}</div>
    </main>
  )
}
