/**
 * PlayMediatorGate — who may open the Mediator's Play screen for a Game: the
 * body of `/play/games/$gameId/mediate`:
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

import { gamePath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import { RoutePending } from '../components/shared/RouteFallbacks'
import { playCopy } from '../messages/play'
import { useGamesQuery } from '../replica/roomCalls'
import { useSync } from '../replica/syncContext'
import { useTableRead } from '../replica/useTable'
import { PlayMediatorCockpit } from './PlayMediatorCockpit'
import { PlayRefusal } from './PlayRefusal'

export function PlayMediatorGate({ gameId }: { gameId: string }) {
  const { status } = useSync()
  // Checked before any Games read: signed out, there is no Game to read.
  if (status === 'signedOut') {
    return (
      <PlayRefusal
        title={playCopy('signInToRunYour')}
        body={playCopy('theMediatorRunsAGame')}
        link={{ href: '/', label: PRODUCT.build }}
      />
    )
  }
  if (status === 'syncing') return <RoutePending label={playCopy('yourSession')} />
  return <SignedInPlayMediatorGate gameId={gameId} />
}

function SignedInPlayMediatorGate({ gameId }: { gameId: string }) {
  const game = useGamesQuery('games.get', { gameId })
  // Asked only of a member: a stranger's `games.get` is already `null`.
  const mediates = useTableRead('mediator.amMediator', game ? { gameId } : 'skip')

  if (game === undefined || (game !== null && mediates === undefined)) {
    return <RoutePending label={playCopy('theGame')} />
  }
  if (game === null || mediates !== true) {
    return (
      <PlayRefusal
        title={playCopy('onlyThisGamesMediatorRuns')}
        body={playCopy('mediateIsForWhoeverMediates')}
        link={{ href: gamePath(gameId), label: playCopy('game') }}
      />
    )
  }
  return <PlayMediatorCockpit gameId={gameId} gameName={game.name} />
}
