/**
 * MediatorGate — who may open the Mediator Dashboard, in each storage mode
 * (docs/architecture/mediator-dashboard.md Q3; apps/itun/CLAUDE.md):
 *
 *  - **Solo** (signed out): the signed-out answer the player Dashboard gives.
 *    Solo has no Games, so it has no Mediator Dashboard.
 *  - **Connected, the Mediator** (`mediator.amMediator`, the server's one
 *    answer): the whole surface, under the Game's name (`games.get`).
 *  - **Connected, not the Mediator** (or not a member, which `games.get`
 *    answers `null` for, telling a stranger nothing): one line and a link to
 *    the Game page. No disabled controls.
 *  - **Disconnected / Outdated:** what the subscriptions last delivered stays
 *    on screen under the app's offline banner, with every control disabled.
 *    Opened cold while offline, it waits (`ConvexPending`).
 *
 * Live, because `games.get` is reactive: a Mediator who hands the table over
 * falls back to the refusal at once. None of this is a boundary; the server
 * refuses every write a non-Mediator might try (`requireMediator`).
 */

import { tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { DashboardRefusal } from '../dashboard/DashboardGate'
import { ConvexPending } from '../shared/ConvexPending'
import { MediatorDashboard } from './MediatorDashboard'

const PENDING = { padding: tokens.space[24] } satisfies CSSProperties

export function MediatorGate({ gameId }: { gameId: string }) {
  const { mode } = useConnection()
  // Checked before any Convex hook: signed out, there is no Game to read.
  if (mode === 'solo') {
    return (
      <DashboardRefusal
        title="Sign in to run your Game"
        body="The Mediator Dashboard runs a Game you mediate. Sign in, open the Game, and press Open the Mediator dashboard."
        link={{ href: '/', label: '← Back to the roster' }}
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
  return <SignedInMediatorGate gameId={gameId} />
}

function SignedInMediatorGate({ gameId }: { gameId: string }) {
  const id = gameId as Id<'games'>
  const game = useQuery(api.games.get, { gameId: id })
  // Asked only of a member: a stranger's `games.get` is already `null`.
  const mediates = useQuery(api.mediator.amMediator, game ? { gameId: id } : 'skip')

  if (game === undefined || (game !== null && mediates === undefined)) {
    return (
      <div style={PENDING}>
        <ConvexPending label="the Game" />
      </div>
    )
  }
  if (game === null || mediates !== true) {
    return (
      <DashboardRefusal
        title="Only this Game's Mediator runs this screen"
        body="The Mediator Dashboard is for whoever mediates the Game. Its players run their pilots from the Game page's Launch Dashboard."
        link={{ href: `/games/${gameId}`, label: '← Back to the Game' }}
      />
    )
  }
  return <MediatorDashboard gameId={gameId} gameName={game.name} />
}
