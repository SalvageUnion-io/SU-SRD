/**
 * PlayMediatorGate — who may open the Mediator's Play screen for a Game: the
 * body of `/play/game/$gameId`:
 *
 *  - **Signed out:** sign in first. There are no Games signed out.
 *  - **Connected, the Mediator** (`mediator.amMediator`, the server's one
 *    answer): the screen, under the Game's name (`games.get`).
 *  - **Connected, not the Mediator** (or not a member, which `games.get`
 *    answers `null` for, telling a stranger nothing): one line and a link to
 *    the Game page. No disabled controls.
 *  - **Disconnected:** what the subscriptions last delivered stays on screen;
 *    opened cold while offline, it waits.
 *
 * Live, because `games.get` is reactive: a Mediator who hands the table over
 * falls back to the refusal at once. None of this is a boundary; the server
 * refuses every write a non-Mediator might try (`requireMediator`).
 */

import { useQuery } from 'convex/react'
import { gamePath } from 'game-domain/entityKinds'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { useConnection } from '../lib/connection/connectionContext'
import { PlayMediatorCockpit } from './PlayMediatorCockpit'
import { PlayRefusal } from './PlayRefusal'

export function PlayMediatorGate({ gameId }: { gameId: string }) {
  const { mode } = useConnection()
  // Checked before any Convex hook: signed out, there is no Game to read.
  if (mode === 'solo') {
    return (
      <PlayRefusal
        title="Sign in to run your Game"
        body="The Mediator runs a Game from Play. Sign in, then open Play and choose Mediate."
        link={{ href: '/', label: '← Back to the roster' }}
      />
    )
  }
  if (mode === 'connecting') return <RoutePending label="your session" />
  return <SignedInPlayMediatorGate gameId={gameId} />
}

function SignedInPlayMediatorGate({ gameId }: { gameId: string }) {
  const id = gameId as Id<'games'>
  const game = useQuery(api.games.get, { gameId: id })
  // Asked only of a member: a stranger's `games.get` is already `null`.
  const mediates = useQuery(api.mediator.amMediator, game ? { gameId: id } : 'skip')

  if (game === undefined || (game !== null && mediates === undefined)) {
    return <RoutePending label="the Game" />
  }
  if (game === null || mediates !== true) {
    return (
      <PlayRefusal
        title="Only this Game's Mediator runs this screen"
        body="Mediate is for whoever mediates the Game. Its players play their Pilots from Play."
        link={{ href: gamePath(gameId), label: '← Back to the Game' }}
      />
    )
  }
  return <PlayMediatorCockpit gameId={gameId} gameName={game.name} />
}
