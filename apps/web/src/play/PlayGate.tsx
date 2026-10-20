/**
 * PlayGate — who may open Play for a pilot, decided live: the body of
 * `/play/$pilotId`.
 *
 * Play opens for any pilot of yours, in a Game or solo. The store holds only
 * your own pilots (a crewmate's never reaches this browser), so a pilot the
 * store has is one you may play; the server refuses every write you may not
 * make, whatever this shows. Every other case is refused:
 *
 *  - an anonymous session: sign in first (nothing is played signed out);
 *  - a pilot this browser does not hold: not found;
 *  - a pilot in a Game the viewer is not a member of (or a Game that is gone,
 *    which `games.get` deliberately does not tell apart).
 *
 * A pilot on the shelf plays solo; there is no Game to ask about. A Game
 * without a Mediator plays too: Play no longer waits on one.
 *
 * It lives in the component, not the route's `beforeLoad`, because loaders
 * never read player entities (`.claude/rules/tanstack-router.md`), and because
 * `games.get` is reactive: a viewer who leaves the Game falls back to the
 * refusal at once.
 *
 * Disconnected is not a refusal: when the Game's answer has not arrived and
 * cannot until the connection is back, it opens on the local pilot, read-only.
 *
 * A mech-keyed URL (`/play/<mech id>`, which `/dashboard/<mech id>` redirects to)
 * resolves through the mech's `mech-to-pilot` link and is replaced with the
 * pilot's URL.
 */

import { useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { containerOf } from 'game-domain/container'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { useConnection } from '../lib/connection/connectionContext'
import { useEntityStore } from '../stores/entityStore'
import { PlayCockpit } from './PlayCockpit'
import { PlayRefusal } from './PlayRefusal'

const TO_PLAY = { href: '/play/', label: 'Play' }

export function PlayGate({ id }: { id: string }) {
  const { mode } = useConnection()

  // Checked before any Convex hook: signed out, there is nothing to read.
  if (mode === 'solo') {
    return (
      <PlayRefusal
        title="Sign in to play"
        body="Play runs your Pilots, solo or in a Game. Sign in, then open Play and choose one."
        link={{ href: '/', label: 'Training Bay' }}
      />
    )
  }
  if (mode === 'connecting') return <RoutePending label="your session" />
  return <SignedInPlayGate id={id} offline={mode === 'disconnected'} />
}

function SignedInPlayGate({ id, offline }: { id: string; offline: boolean }) {
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

  useEffect(() => {
    if (flownBy !== null) {
      void navigate({ to: '/play/$pilotId', params: { pilotId: flownBy }, replace: true })
    }
  }, [flownBy, navigate])

  if (pilot === null) {
    return (
      <PlayRefusal
        title={mech === null ? 'Pilot not found' : `${mech.name} has no Pilot`}
        body={
          mech === null
            ? 'It may have been deleted, or not reached this browser yet.'
            : `Play runs a Pilot. Assign ${mech.name} to a Pilot, then play that Pilot.`
        }
        link={TO_PLAY}
      />
    )
  }

  // On the shelf: solo, with no Game to ask about.
  if (gameId === null) {
    return (
      <PlayCockpit target={{ pilotId: pilot.id, gameId: null, gameName: null, mediator: false }} />
    )
  }

  // Offline with nothing cached: open read-only rather than wait for an answer
  // that cannot come. See the header.
  if (game === undefined && offline) {
    return <PlayCockpit target={{ pilotId: pilot.id, gameId, gameName: null, mediator: false }} />
  }
  if (game === undefined) return <RoutePending label="the Game" />

  if (game === null) {
    return (
      <PlayRefusal
        title="You're not in this Pilot's Game"
        body={`Play opens for members of the Game ${pilot.name} plays in.`}
        link={TO_PLAY}
      />
    )
  }

  return (
    <PlayCockpit
      target={{ pilotId: pilot.id, gameId, gameName: game.name, mediator: game.mediator }}
    />
  )
}
