/**
 * GameHub — what `/` shows when a Game is picked in its "Showing" select.
 *
 * There used to be a Games page (`/games`, choose a table), a Game page
 * (`/games/:id`, its crew and panels) and a Mediator page (`/mediator/:id`, the
 * same crew plus the Mediator's instruments). Three pages for one table, and a
 * player had to know which one held the thing they wanted. They are one place
 * now: the hub at `/`, which already listed My Stuff, lists a Game the same way
 * and puts everything you can do about the table below the lists —
 *
 *  1. **The roster** (`GameRoster`): the three columns, yours first.
 *  2. **Game** — every member: the answer queue, Downtime; and, for the
 *     Organizer, invites, who mediates, and ending the game.
 *  3. **Mediator** — the Mediator alone (`MediatorSection`): vitals, propose,
 *     tell the table, the opposition.
 *
 * Starting or joining a Game is "+ New game" at the top of the hub
 * (`NewGameControl`), so nothing here is about choosing a table.
 *
 * Connected only: `Roster` mounts this only when the mode is Connected and the
 * active container is a Game, so every hook below has a provider.
 */

import { Button, Card, Text, tokens } from 'component-lib'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { SHELF } from '../../lib/container'
import { setActiveContainer } from '../../stores/activeContainerStore'
import type { SegmentKind } from '../roster/RosterColumn'
import { ConvexPending } from '../shared/ConvexPending'
import { DeleteGameDialog } from './DeleteGameDialog'
import { DowntimePanel } from './DowntimePanel'
import { GamePanel, GameSection } from './GamePanel'
import { GameRoster } from './GameRoster'
import { InvitePanel } from './InvitePanel'
import { MediatorPanel } from './MediatorPanel'
import { MediatorSection } from './MediatorTools'
import { ProposalInbox } from './ProposalInbox'

type Game = NonNullable<FunctionReturnType<typeof api.games.get>>

type GameHubProps = {
  gameId: string
  activeSegment: SegmentKind
  onSegmentChange: (kind: SegmentKind) => void
}

const PENDING = { marginTop: tokens.space[24] } satisfies CSSProperties

const NOT_IN = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  padding: tokens.space[16],
} satisfies CSSProperties

const NOT_IN_CARD = { marginTop: tokens.space[24] } satisfies CSSProperties

/**
 * A Game the viewer is not in: they left, it ended, or a stale selection
 * points at it. `games.get` answers `null` for all of them alike, deliberately
 * — a non-member must not be able to tell an existing Game from a deleted one.
 */
function NotInGame() {
  return (
    <div style={NOT_IN_CARD}>
      <Card>
        <div style={NOT_IN}>
          <Text>
            You are not in this game. Ask whoever organises it for an invite code, then join with “+
            New game”.
          </Text>
          <div>
            <Button variant="default" size="compact" onClick={() => setActiveContainer(SHELF)}>
              Show My Stuff
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/** The Game section: what every member does about the table, and the Organizer's admin. */
function GameActions({ game }: { game: Game }) {
  const gameId = game._id as Id<'games'>
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <>
      <GameSection
        id="game-section-heading"
        title="Game"
        hint={
          game.organizer
            ? 'You organize this game: invites, who mediates, and ending it are yours.'
            : undefined
        }
      >
        {/* Renders nothing until the Mediator has asked something. */}
        <ProposalInbox gameId={gameId} />
        <DowntimePanel gameId={gameId} />
        {/* Invites are administrative, so only the Organizer sees them
            (ADR-030 §3); the server refuses `invites.list` to anyone else. */}
        {game.organizer && (
          <GamePanel title="Invite someone">
            <InvitePanel gameId={gameId} />
          </GamePanel>
        )}
        {/* Appointing the Mediator is the ONLY way the flag is set:
            `games.create` seats its creator with `mediator: false`. */}
        {game.organizer && <MediatorPanel gameId={gameId} />}
        {/* Last, and the Organizer's alone: ending the campaign. */}
        {game.organizer && (
          <GamePanel title="End this game">
            <Text>
              Deleting {game.name} disbands the crew for everyone in it. Every pilot and mech goes
              back to its owner&rsquo;s My Stuff, and the crawler comes to yours — but the table,
              its invites and its wiring are gone for good.
            </Text>
            <div>
              <Button variant="danger" size="compact" onClick={() => setConfirmingDelete(true)}>
                Delete this game
              </Button>
            </div>
          </GamePanel>
        )}
      </GameSection>

      <DeleteGameDialog
        game={confirmingDelete ? game : null}
        onClose={() => setConfirmingDelete(false)}
        // Back to My Stuff BEFORE `games.get` resolves to `null`, which would
        // otherwise show "You are not in this game" — true, and read as an
        // error by someone who just deleted it.
        onDeleted={() => setActiveContainer(SHELF)}
      />
    </>
  )
}

export function GameHub({ gameId, activeSegment, onSegmentChange }: GameHubProps) {
  // `games.get` rather than listMine-and-find: it distinguishes "still
  // loading" from "not a member" without fetching every table you are in.
  const game = useQuery(api.games.get, { gameId: gameId as Id<'games'> })

  if (game === undefined) {
    return (
      <div style={PENDING}>
        <ConvexPending label="this game" />
      </div>
    )
  }
  if (game === null) return <NotInGame />

  return (
    <>
      <GameRoster
        gameId={gameId}
        gameName={game.name}
        activeSegment={activeSegment}
        onSegmentChange={onSegmentChange}
      />
      <GameActions game={game} />
      <MediatorSection gameId={gameId as Id<'games'>} />
    </>
  )
}
