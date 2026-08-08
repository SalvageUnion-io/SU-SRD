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

import { Badge, Card, PageHeading, PageShell, Text } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { AppLink } from '../shared/AppLink'
import { ConvexPending } from '../shared/ConvexPending'
import { DowntimePanel } from './DowntimePanel'
import { GameRoster } from './GameRoster'
import { InvitePanel } from './InvitePanel'
import { MediatorPanel } from './MediatorPanel'
import { ProposalInbox } from './ProposalInbox'

function GameBody({ gameId }: { gameId: string }) {
  // `games.get` rather than listMine-and-find: this route wants one Game, and
  // it distinguishes "still loading" from "not a member" without fetching every
  // table the viewer belongs to.
  const game = useQuery(api.games.get, { gameId: gameId as Id<'games'> })

  if (game === undefined) return <ConvexPending label="this game" />
  // `null` covers both "you left" and "no such game", deliberately — a
  // non-member must not be able to tell an existing Game from a deleted one.
  if (game === null) {
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
      {/* Invites are administrative, so they live with the Game rather than in
          the lobby, and only the Organizer sees them (ADR-030 §3). */}
      {game.organizer && (
        <Card
          headerBg="bg-ink"
          headerContent={
            <Badge shape="stamp" as="h2" size="full">
              Invite someone
            </Badge>
          }
        >
          <div className="p-4">
            <InvitePanel gameId={gameId as Id<'games'>} />
          </div>
        </Card>
      )}
      {/* Appointing the Mediator is administrative, so it sits beside invites
          and is Organizer-only — and it is the ONLY way the flag can be set:
          `games.create` seats its creator with `mediator: false`. See
          MediatorPanel's header. */}
      {game.organizer && <MediatorPanel gameId={gameId as Id<'games'>} />}
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
    <PageShell>
      <PageHeading className="w-fit">Game</PageHeading>
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
    </PageShell>
  )
}
