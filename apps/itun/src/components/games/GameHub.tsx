/**
 * GameHub — a Game's own page, `/games/$gameId` (issues 1255 and 1278).
 *
 * One place per table: the hub lists a Game the way Shelves lists your things
 * and puts everything you can do about the table below the lists, as board M2
 * draws it (docs/architecture/mediator-dashboard.md Q10–Q13):
 *
 *  0. **The band** (`GameBand`): the Game's name on the crawler's pink, and
 *     for its Mediator a YOU MEDIATE stamp and **Open the Mediator
 *     dashboard** (`/mediator/$gameId`), where the Mediator's instruments
 *     live now.
 *  1. **Launch Dashboard** (`LaunchDashboard`): the one way into the player
 *     Dashboard, for players and the Mediator alike.
 *  2. **The roster** (`GameRoster`): the three columns, yours first.
 *  3. Two columns of sections. **Every member:** Crew & seats, the Downtime
 *     track, and the proposals awaiting their answer. **The Mediator:**
 *     Downtime's controls and Proposals you sent. **The Organizer:** Invite
 *     links, Asking to join and The Game's Hand over, which the server
 *     refuses anyone else (`requireOrganizer`). Anyone else brings a friend
 *     with "Copy invite link", which asks the Organizer to let them in.
 *
 * Starting a Game is "+ New game" at the top of the hub (`NewGameControl`), and
 * joining one is an invite link (`InviteScreen`), so nothing here is about
 * choosing a table.
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
import { useShowContainer } from '../container/useShowContainer'
import { readCrawler } from '../mediator/crawlerReading'
import type { SegmentKind } from '../roster/RosterColumn'
import { ConvexPending } from '../shared/ConvexPending'
import { CopyInviteLink } from './CopyInviteLink'
import { CrewSeats } from './CrewSeats'
import { DeleteGameDialog } from './DeleteGameDialog'
import { DowntimeTrack } from './DowntimeTrack'
import { GameBand } from './GameBand'
import { GameRoster } from './GameRoster'
import { HubSection } from './HubSection'
import { HUB_COLUMN, HUB_COLUMNS, HUB_COPY } from './hubStyles'
import { InvitePanel } from './InvitePanel'
import { JoinRequests } from './JoinRequests'
import { LaunchDashboard } from './LaunchDashboard'
import { ProposalInbox } from './ProposalInbox'
import { ProposalsSent } from './ProposalsSent'
import { seatRows } from './seatRows'
import { TheGame } from './TheGame'

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

/** The band sits a step below the hub's header row. */
const BAND = { marginTop: tokens.space[20], marginBottom: tokens.space[8] } satisfies CSSProperties

/**
 * A Game the viewer is not in: they left, it ended, or a stale selection
 * points at it. `games.get` answers `null` for all of them alike, deliberately
 * — a non-member must not be able to tell an existing Game from a deleted one.
 */
function NotInGame() {
  const showContainer = useShowContainer()
  return (
    <div style={NOT_IN_CARD}>
      <Card>
        <div style={NOT_IN}>
          <Text>
            You are not in this game. Ask its Mediator or a crewmate for an invite link, then open
            it to join.
          </Text>
          <div>
            <Button variant="default" size="compact" onClick={() => showContainer(SHELF)}>
              Back to your shelves
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/** The sections under the roster, in board M2's two columns. */
function GameSections({ game }: { game: Game }) {
  const gameId = game._id as Id<'games'>
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const showContainer = useShowContainer()
  const listing = useQuery(api.entities.listForGame, { gameId })
  const members = useQuery(api.games.members, { gameId })
  const me = useQuery(api.account.me, {})
  const viewerId = me?._id ?? null

  const primary =
    listing?.crawlers.find((c) => c._id === listing.primaryCrawlerId) ??
    listing?.crawlers[0] ??
    null
  const crawler = primary === null ? null : readCrawler(primary)
  const seats =
    listing === undefined || members === undefined ? null : seatRows(listing, members, viewerId)

  return (
    <>
      <div style={HUB_COLUMNS}>
        <div style={HUB_COLUMN}>
          {seats === null ? (
            <ConvexPending label="the crew" />
          ) : (
            <CrewSeats
              crawler={crawler}
              rows={seats.rows}
              claimed={seats.claimed}
              total={seats.total}
            />
          )}
          <DowntimeTrack gameId={gameId} mediator={game.mediator} crawler={crawler} />
          {/* Renders nothing until the Mediator has asked something. */}
          <ProposalInbox gameId={gameId} />
          {/* `proposals.sent` is the Mediator's alone (`requireMediator`). */}
          {game.mediator && <ProposalsSent gameId={gameId} />}
        </div>
        <div style={HUB_COLUMN}>
          {/* Invites are administrative, so only the Organizer sees them
              (ADR-030 §3); the server refuses `invites.list` to anyone else. */}
          {game.organizer ? (
            <>
              <InvitePanel gameId={gameId} />
              <JoinRequests gameId={gameId} />
            </>
          ) : (
            // Every member can bring someone to the table (issue 1255): a
            // player's link asks the Organizer to let them in (`invites.link`).
            <HubSection id="invite-crewmate-heading" title="Invite a crewmate">
              <p style={HUB_COPY}>
                Anyone who opens this link asks to join, and the organizer lets them in.
              </p>
              <div>
                <CopyInviteLink gameId={gameId} />
              </div>
            </HubSection>
          )}
          <TheGame
            gameId={gameId}
            viewerId={viewerId}
            organizer={game.organizer}
            onDelete={() => setConfirmingDelete(true)}
          />
        </div>
      </div>

      <DeleteGameDialog
        game={confirmingDelete ? game : null}
        onClose={() => setConfirmingDelete(false)}
        // Back to Shelves BEFORE `games.get` resolves to `null`, which would
        // otherwise show "You are not in this game" — true, and read as an
        // error by someone who just deleted it.
        onDeleted={() => showContainer(SHELF)}
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
      <div style={BAND}>
        <GameBand gameId={gameId} name={game.name} mediator={game.mediator} />
      </div>
      <LaunchDashboard gameId={gameId} />
      <GameRoster
        gameId={gameId}
        gameName={game.name}
        activeSegment={activeSegment}
        onSegmentChange={onSegmentChange}
      />
      <GameSections game={game} />
    </>
  )
}
