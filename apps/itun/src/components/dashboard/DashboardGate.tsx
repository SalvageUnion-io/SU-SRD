/**
 * DashboardGate — who may open the Dashboard, decided live (ADR-038 §1).
 *
 * The Dashboard opens only for a pilot in a Game that has a Mediator. Every
 * other case gets a shell that says what is missing:
 *
 *  - an anonymous session (no account, so no Game);
 *  - a pilot on the shelf, not in a Game;
 *  - a viewer who is not a member of the pilot's Game (or a Game that is gone,
 *    which `games.get` deliberately does not tell apart);
 *  - a Game with no Mediator.
 *
 * It lives in the component, not the route's `beforeLoad`, because loaders
 * never read player entities (`.claude/rules/tanstack-router.md`), and because
 * it has to stay live: `games.get` and `games.members` are reactive, so an open
 * Dashboard falls back to the shell the moment its Game loses its Mediator or
 * the viewer leaves it.
 *
 * Disconnected is not a refusal. The sheets go read-only offline, and so does
 * the Dashboard: when the Game's answers have not arrived and cannot arrive
 * until the connection is back, it opens on the local pilot rather than
 * waiting forever. Nothing it renders can write while offline.
 *
 * An old mech-keyed URL (`/dashboard/<mech id>`) resolves through the mech's
 * `mech-to-pilot` link and is replaced with the pilot's URL.
 *
 * None of this is a boundary. The server refuses every write the viewer may
 * not make, whatever this shows.
 */

import { useNavigate } from '@tanstack/react-router'
import { PageHeading, PageShell, Text, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useEffect } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { containerOf } from '../../lib/container'
import { gameHasMediator } from '../../lib/games/gameRoster'
import { useEntityStore } from '../../stores/entityStore'
import { AppLink } from '../shared/AppLink'
import { ConvexPending } from '../shared/ConvexPending'
import { Dashboard } from './Dashboard'

const BODY = { maxWidth: '36rem', textAlign: 'left' } satisfies CSSProperties

const PENDING = { padding: tokens.space[24] } satisfies CSSProperties

type RefusalProps = {
  title: string
  body: string
  link: { href: string; label: string }
}

/** The shell every refusal renders: what is missing, and where to go instead. */
function DashboardRefusal({ title, body, link }: RefusalProps) {
  return (
    <PageShell>
      <PageHeading>{title}</PageHeading>
      <Text variant="hint" style={BODY}>
        {body}
      </Text>
      <div>
        <AppLink href={link.href}>{link.label}</AppLink>
      </div>
    </PageShell>
  )
}

const TO_ROSTER = { href: '/', label: '← Back to the roster' }

export function DashboardGate({ id }: { id: string }) {
  const { mode } = useConnection()

  // Checked before any Convex hook: a build with no Convex mounts no provider,
  // and such a build is always Solo.
  if (mode === 'solo') {
    return (
      <DashboardRefusal
        title="Sign in to play"
        body="The Dashboard runs a pilot in a Game with a Mediator. Sign in, join a Game, and press Play on your pilot in its roster."
        link={TO_ROSTER}
      />
    )
  }
  if (mode === 'connecting') {
    return (
      <div style={PENDING}>
        <ConvexPending label="your session" />
      </div>
    )
  }
  return <SignedInGate id={id} offline={mode === 'disconnected'} />
}

function SignedInGate({ id, offline }: { id: string; offline: boolean }) {
  const storeState = useEntityStore()
  const navigate = useNavigate()

  // `id` is a pilot's, or — from an old link — a mech's, resolved to the pilot
  // it is assigned to.
  const pilotById = storeState.get('pilot', id)
  const mech = pilotById === null ? storeState.get('mech', id) : null
  const flownBy =
    mech === null
      ? null
      : (storeState.softLinks.find((l) => l.type === 'mech-to-pilot' && l.from.id === mech.id)?.to
          .id ?? null)
  const pilot = pilotById ?? (flownBy === null ? null : storeState.get('pilot', flownBy))

  const container = pilot === null ? null : containerOf(pilot)
  const gameId = container?.kind === 'game' ? (container.gameId as Id<'games'>) : null
  const game = useQuery(api.games.get, gameId === null ? 'skip' : { gameId })
  // Asked only once the viewer is known to be a member: `members` throws for
  // anybody else, where `get` answers null.
  const members = useQuery(api.games.members, gameId === null || !game ? 'skip' : { gameId })

  useEffect(() => {
    if (flownBy !== null) {
      void navigate({ to: '/dashboard/$pilotId', params: { pilotId: flownBy }, replace: true })
    }
  }, [flownBy, navigate])

  if (pilot === null) {
    return (
      <DashboardRefusal
        title={mech === null ? 'Pilot not found' : `${mech.name} has no pilot`}
        body={
          mech === null
            ? 'It may have been deleted, or not reached this browser yet.'
            : `The Dashboard runs a pilot now. Assign ${mech.name} to a pilot, then press Play on the pilot in its Game's roster.`
        }
        link={TO_ROSTER}
      />
    )
  }

  const sheet = { href: `/sheet/pilot/${pilot.id}`, label: `Open ${pilot.name}'s live sheet` }

  if (gameId === null) {
    return (
      <DashboardRefusal
        title={`Move ${pilot.name} into a Game to play`}
        body="The Dashboard runs a pilot in a Game with a Mediator. Until then, edit the live sheet by hand."
        link={sheet}
      />
    )
  }

  // Offline with nothing cached: open read-only rather than wait for answers
  // that cannot come. See the header.
  const unanswered = game === undefined || (game !== null && members === undefined)
  if (unanswered && offline)
    return <Dashboard pilotId={pilot.id} mediator={game?.mediator ?? false} />
  if (unanswered) {
    return (
      <div style={PENDING}>
        <ConvexPending label="the Game" />
      </div>
    )
  }

  if (game === null) {
    return (
      <DashboardRefusal
        title="You're not in this pilot's Game"
        body={`The Dashboard opens for members of the Game ${pilot.name} plays in.`}
        link={TO_ROSTER}
      />
    )
  }

  if (!gameHasMediator(members ?? [])) {
    return (
      <DashboardRefusal
        title="This Game has no Mediator"
        body="Ask the Organizer to name one, or edit your live sheet."
        link={sheet}
      />
    )
  }

  return <Dashboard pilotId={pilot.id} mediator={game.mediator} />
}
