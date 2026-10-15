import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import { useServerAction } from '../../lib/connection/useServerAction'
import { invitePath } from '../../lib/games/inviteLink'
import { SignInControl } from '../account/SignInControl'
import { useShowContainer } from '../entityContainer/useShowContainer'
import { Badge, Button, Card, ChapterBand, FieldError, PageShell, Text, tokens } from '../index'
import { WayOutLink } from '../shared/WayOutLink'

/**
 * `/invite/$token` — a Game's invite URL. A Game is joined from its link,
 * never a typed code, and joins you as a player.
 *
 * Signed-out is the **expected** state here, not an edge case: the whole point
 * of a link is that you can hand it to someone who has no account yet. So the
 * page describes the invitation *before* asking for a sign-in, and a dead link
 * says so without ever prompting one — being asked to authenticate only to find
 * out the link expired is the worst version of this screen. (A dead link does
 * offer a plain sign-in beside "Back to Shelves", as a way on once it has
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
 * Old `/join/:code` links from Discord history land here too (the Worker 301s
 * them, `src/worker/retiredRedirects.ts`): the Game's current code joins like
 * any link, and any other code gets the same explanation of invite links.
 */

const ACTIONS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const PAD = { ...BODY, padding: tokens.space[16] } satisfies CSSProperties

const HINT = { textAlign: 'left' } satisfies CSSProperties

/** The page column: an invitation is a short read, so it does not span the hub's width. */
const COLUMN = { maxWidth: '36rem', width: '100%' } satisfies CSSProperties

/** How invites work, for a dead link and for a typed code from before links. */
const HOW_INVITES_WORK =
  'A Game is joined from the invite link its Organiser sends you. Open the link and sign in to join; there is no code to type.'

const DEAD_HEADLINE = 'That invite link does not work.'

const DEAD_ASK =
  'It may have been reset, or not copied whole. Ask whoever invited you for the current link.'

const BACK = { href: '/', label: 'Back to Hangar' }

/**
 * A dead link's ways on: back to Shelves, as a button-shaped link with a
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
  const showContainer = useShowContainer()

  const join = useServerAction(() => redeem({ code: token }), {
    failure: 'That invite could not be used. Try again.',
  })
  // The arrival join runs once, whatever the live preview does after it.
  const arrived = useRef(false)

  const accept = async () => {
    const result = await join.run()
    if (!result.ok) return
    // Joined (or already in it): open the Game's own page.
    showContainer({ kind: 'game', gameId: result.value.gameId })
  }

  const live = preview != null

  // biome-ignore lint/correctness/useExhaustiveDependencies: `accept` is rebuilt every render; the ref makes this a one-shot keyed on the preview landing
  useEffect(() => {
    if (!joinOnArrival || !live || arrived.current) return
    arrived.current = true
    void accept()
  }, [joinOnArrival, live])

  if (preview === undefined) return <Text>Checking that invite…</Text>

  if (preview === null) return <DeadLink headline={DEAD_HEADLINE} ask={DEAD_ASK} />

  return (
    <Card>
      <div style={PAD}>
        <div>
          <Badge shape="stamp" size="mini">
            You have been invited
          </Badge>
        </div>
        <Text>
          {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>.
        </Text>
        <Text variant="hint" style={HINT}>
          Everyone at a table can read each other’s sheets.
        </Text>
        <div style={ACTIONS}>
          <Button
            variant="primary"
            size="compact"
            disabled={join.pending}
            onClick={() => void accept()}
          >
            Join this Game
          </Button>
        </div>
        <FieldError>{join.error}</FieldError>
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
  if (preview === null) return <DeadLink headline={DEAD_HEADLINE} ask={DEAD_ASK} signIn />

  return (
    <Card>
      <div style={PAD}>
        <div>
          <Badge shape="stamp" size="mini">
            You have been invited
          </Badge>
        </div>
        <Text>
          {preview.invitedBy} invited you to <strong>{preview.gameName}</strong>.
        </Text>
        <Text variant="hint" style={HINT}>
          Sign in to join. Your pilots, mechs and crawlers live on your account, and signing in is
          what seats you at the table.
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
      <ChapterBand tone="cantina">Join a Game</ChapterBand>
      <div style={COLUMN}>{body()}</div>
    </PageShell>
  )
}
