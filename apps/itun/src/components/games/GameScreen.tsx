/**
 * GameScreen — one Game, as a player sees it.
 *
 * The crew roster, the answer queue, and the table's Downtime: everything a
 * member needs during a session that is not the Mediator's private apparatus.
 * The Mediator opens `MediatorScreen`, which is this plus the instruments only
 * they may see.
 *
 * ## Why the lobby no longer carries this
 *
 * `GamesScreen` used to render a proposal inbox and a Downtime panel inside
 * every row of the games list, so a member of three campaigns met three
 * Downtime panels stacked above each other with nothing saying which table each
 * belonged to. A list of games is a list; the work happens inside one.
 */

import { useQuery } from 'convex/react'
import { Card, Text } from 'component-lib'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { DowntimePanel } from './DowntimePanel'
import { GameRoster } from './GameRoster'
import { ProposalInbox } from './ProposalInbox'
import { TITLE } from './gameChrome'
import { AppLink } from '../shared/AppLink'

function GameBody({ gameId }: { gameId: string }) {
  const games = useQuery(api.games.listMine, {})
  const game = games?.find((g) => g._id === gameId)

  if (games === undefined) return <Text>Loading this game…</Text>
  if (game === undefined) {
    return (
      <Card>
        <div className="p-4">
          <Text>
            You are not in this game. Ask whoever organises it for an invite code, then join from
            the Games screen.
          </Text>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <GameRoster gameId={gameId} gameName={game.name} />
      <ProposalInbox gameId={gameId as Id<'games'>} />
      <DowntimePanel gameId={gameId as Id<'games'>} />
      {game.mediator && (
        <AppLink href={`/mediator/${gameId}`} className="font-cond text-sm font-bold uppercase">
          Open the Mediator surface →
        </AppLink>
      )}
    </div>
  )
}

export function GameScreen({ gameId }: { gameId: string }) {
  const { mode } = useConnection()

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <Text as="h1" className={TITLE}>
        Game
      </Text>
      {!isConvexConfigured || mode !== 'connected' ? (
        <Card>
          <div className="p-4">
            <Text>
              A Game is shared state, so it needs a connected account. You are playing solo — your
              builds are on this device and need no account at all.
            </Text>
          </div>
        </Card>
      ) : (
        <GameBody gameId={gameId} />
      )}
    </main>
  )
}
