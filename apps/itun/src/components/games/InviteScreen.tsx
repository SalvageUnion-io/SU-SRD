import { Badge, Button, Card, ChapterBand, PageShell, Text, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { invitePath } from '../../lib/games/inviteLink'
import { SignInControl } from '../account/SignInControl'
import { useShowContainer } from '../container/useShowContainer'
import { failureMessage } from '../shared/useConfirm'
import { WayOutLink } from '../shared/WayOutLink'

/**
 * `/invite/$token` — an invite link (issue 1255). A Game is joined from a link,
 * never a typed code.
 *
 * Signed-out is the **expected** state here, not an edge case: the whole point
 * of a link is that you can hand it to someone who has no account yet. So the
 * page describes the invitation *before* asking for a sign-in, and a dead link
 * says so without ever prompting one — being asked to authenticate only to find
 * out the link expired is the worst version of this screen. (A dead link does
 * offer a plain sign-in beside "Back to your shelves", as a way on once it has
 * said the link is dead; it is never "Sign in to join".)
 *
 * Opening one signs you in if needed and joins that Game. "Sign in to join"
 * sends Discord's round trip back here with `?join=1`, and the page joins on
 * arrival: the press that started the sign-in was the decision, so asking for a
 * second press would only be asking twice. A visitor who arrives already signed
 * in presses Join once. Either way, joining opens the Game's own page.
 *
 * The token lives in the URL rather than in `sessionStorage`, so it survives the
 * OAuth round trip and still works when pasted into a different browser.
 *
 * Old `/join/:code` links from Discord history land here too
 * (`routes/join/$code.tsx`): a live code joins like any link, and a dead or
 * unknown one gets the same explanation of invite links.
 */

const ACTIONS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const PAD = { ...BODY, padding: tokens.space[16] } satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

const ERROR = { ...HINT, color: tokens.color.rollCascade } satisfies CSSProperties

/** The page column: an invitation is a short read, so it does not span the hub's width. */
const COLUMN = { maxWidth: '36rem', width: '100%' } satisfies CSSProperties

/** What the invite is worth, phrased for the person holding it. */
const DEAD_LINK_COPY = {
  revoked: 'That invite link has been revoked.',
  declined: 'That invite was declined.',
  expired: 'That invite link has expired.',
  exhausted: 'That invite link has already been used.',
} as const

/** How invites work now, for a dead link and for a typed code from before links. */
const HOW_INVITES_WORK =
  'A Game is joined from an invite link its Mediator or a crewmate sends you. Open the link and sign in to join; there is no code to type.'

const BACK = { href: '/', label: 'Back to your shelves' }

/**
 * A dead link's ways on: back to your shelves, as a button-shaped link with a
 * full touch target and, signed out, a sign-in beside it. That sign-in is a way
 * on, not a prompt: the page has already said the link is dead, and signing in
 * lands on your shelves rather than pretending it could still join.
 */
function Back({ signIn = false }: { signIn?: boolean }) {
  return (
    <div style={ACTIONS}>
      <WayOutLink href={BACK.href} label={BACK.label} />
      {signIn && <SignInControl redirectTo={BACK.href} />}
    </div>
  )
}

/** A link that cannot be used, and what to do instead. */
function DeadLink({
  headline,
  ask,
  signIn = false,
}: {
  headline: string
  ask: string
  /** The visitor is signed out: offer a sign-in beside the way back. */
  signIn?: boolean
}) {
  return (
    <Card>
      <div style={PAD}>
        <Text>{headline}</Text>
        <Text variant="hint" style={HINT}>
          {ask}
        </Text>
        <Text variant="hint" style={HINT}>
          {HOW_INVITES_WORK}
        </Text>
        <Back signIn={signIn} />
      </div>
    </Card>
  )
}

type InviteProps = {
  token: string
  /** Back from "Sign in to join": join without asking again. */
  joinOnArrival?: boolean
}

function ConnectedInvite({ token, joinOnArrival = false }: InviteProps) {
  const preview = useQuery(api.invites.preview, { code: token })
  const redeem = useMutation(api.invites.redeem)
  const decline = useMutation(api.invites.decline)
  const showContainer = useShowContainer()

  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [declined, setDeclined] = useState(false)
  // The arrival join runs once, whatever the live preview does after it.
  const arrived = useRef(false)

  const accept = () => {
    setError(null)
    void redeem({ code: token })
      .then((result) => {
        if (result.kind === 'pending') {
          setPending(true)
          return
        }
        // Joined (or already in it): open the Game's own page.
        showContainer({ kind: 'game', gameId: result.gameId })
      })
      .catch((err: unknown) =>
        setError(failureMessage(err, 'That invite could not be used. Try again.'))
      )
  }

  const live =
    preview != null &&
    preview.status === 'active' &&
    !(preview.addressed === 'discord' && preview.forYou === false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `accept` is rebuilt every render; the ref makes this a one-shot keyed on the preview landing
  useEffect(() => {
    if (!joinOnArrival || !live || arrived.current) return
    arrived.current = true
    accept()
  }, [joinOnArrival, live])

  if (preview === undefined) return <Text>Checking that invite…</Text>

  if (preview === null) {
    return (
      <DeadLink
        headline="That invite link is not valid."
        ask="Check that the whole link was copied, or ask whoever invited you for a fresh one."
      />
    )
  }

  // Before the dead-link check: declining makes the live preview report
  // 'declined', and the person who just said no should read that they did,
  // not that somebody else's invite went dead.
  if (declined) {
    return (
      <Card>
        <div style={PAD}>
          <Text>You declined the invite to {preview.gameName}.</Text>
          <Text variant="hint" style={HINT}>
            If you change your mind, ask {preview.invitedBy} for a new one.
          </Text>
          <Back />
        </div>
      </Card>
    )
  }

  if (preview.status !== 'active') {
    return (
      <DeadLink
        headline={DEAD_LINK_COPY[preview.status]}
        ask={`Ask ${preview.invitedBy} for a fresh link.`}
      />
    )
  }

  // A Discord-addressed invite opened while signed in as somebody else. Saying
  // so before the button is pressed beats a refusal after it; the server names
  // nobody, and neither does this.
  if (preview.addressed === 'discord' && preview.forYou === false) {
    return (
      <Card>
        <div style={PAD}>
          <Text>This invite to {preview.gameName} was sent to a different Discord account.</Text>
          <Text variant="hint" style={HINT}>
            Sign in with the account it was sent to, or ask {preview.invitedBy} to invite this one.
          </Text>
          <Back />
        </div>
      </Card>
    )
  }

  if (pending) {
    return (
      <Card>
        <div style={PAD}>
          <Text>Asked to join {preview.gameName}.</Text>
          <Text variant="hint" style={HINT}>
            The organizer has to let you in before you can see the table. You can close this page;
            the Game shows up in your Games once they do.
          </Text>
          <Back />
        </div>
      </Card>
    )
  }

  const refuse = () => {
    setError(null)
    void decline({ code: token })
      .then(() => setDeclined(true))
      .catch((err: unknown) =>
        setError(failureMessage(err, 'That invite could not be declined. Try again.'))
      )
  }

  return (
    <Card>
      <div style={PAD}>
        <div>
          <Badge shape="stamp" size="mini">
            You have been invited
          </Badge>
        </div>
        <Text>
          {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>
          {preview.role === 'mediator' ? ' as its Mediator' : ''}.
        </Text>
        {preview.grantCount > 0 && (
          <Text variant="hint" style={HINT}>
            {preview.grantCount === 1
              ? 'A character is waiting for you.'
              : `${preview.grantCount} characters are waiting for you.`}
          </Text>
        )}
        <Text variant="hint" style={HINT}>
          {preview.requiresApproval
            ? 'Joining asks the organizer to let you in.'
            : 'Everyone at a table can read each other’s sheets.'}
        </Text>
        <div style={ACTIONS}>
          <Button variant="primary" size="compact" onClick={accept}>
            {preview.requiresApproval ? 'Ask to join' : 'Join this game'}
          </Button>
          {/* Only an invite addressed to you can be declined: an open link may
              be meant for the whole table (ADR-039). */}
          {preview.addressed !== null && (
            <Button variant="ghost" size="compact" onClick={refuse}>
              Decline
            </Button>
          )}
        </div>
        {error !== null && (
          <Text variant="hint" role="alert" style={ERROR}>
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
function SignedOutInvite({ token }: { token: string }) {
  const preview = useQuery(api.invites.preview, { code: token })

  if (preview === undefined) return <Text>Checking that invite…</Text>
  if (preview === null) {
    return (
      <DeadLink
        headline="That invite link is not valid."
        ask="Check that the whole link was copied, or ask whoever invited you for a fresh one."
        signIn
      />
    )
  }
  if (preview.status !== 'active') {
    return (
      <DeadLink
        headline={DEAD_LINK_COPY[preview.status]}
        ask={`Ask ${preview.invitedBy} for a fresh link.`}
        signIn
      />
    )
  }

  return (
    <Card>
      <div style={PAD}>
        <div>
          <Badge shape="stamp" size="mini">
            You have been invited
          </Badge>
        </div>
        <Text>
          {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>
          {preview.role === 'mediator' ? ' as its Mediator' : ''}.
        </Text>
        <Text variant="hint" style={HINT}>
          {preview.addressed === 'discord'
            ? 'This invite was sent to one Discord account. Sign in with that account to join.'
            : 'Sign in to join. Your pilots, mechs and crawlers live on your account, and signing in is what seats you at the table.'}
        </Text>
        <div>
          {/* Back here with `?join=1`, so the round trip ends in the Game. */}
          <SignInControl label="Sign in to join" redirectTo={`${invitePath(token)}?join=1`} />
        </div>
      </div>
    </Card>
  )
}

export function InviteScreen({ token, joinOnArrival = false }: InviteProps) {
  const { mode } = useConnection()

  const body = () => {
    if (mode === 'connected') return <ConnectedInvite token={token} joinOnArrival={joinOnArrival} />
    if (mode === 'disconnected') {
      return (
        <Card>
          <div style={PAD}>
            <Text>You are offline, so this invite cannot be checked right now.</Text>
          </div>
        </Card>
      )
    }
    return <SignedOutInvite token={token} />
  }

  return (
    <PageShell>
      <ChapterBand>Join a game</ChapterBand>
      <div style={COLUMN}>{body()}</div>
    </PageShell>
  )
}
