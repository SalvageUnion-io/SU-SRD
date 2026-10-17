/**
 * GameHub — a Game's own page, `/games/$gameId`.
 *
 * One place per table: the hub lists a Game the way Shelves lists your things
 * and puts everything you can do about the table below the lists, as board M2
 * draws it (docs/architecture/mediator-dashboard.md Q10–Q13):
 *
 *  0. **The band** (`GameBand`): the page's controls (`Roster`'s), the
 *     Game's name on the crawler's pink, and one **Launch Dashboard** chip:
 *     the Mediator's (after a YOU MEDIATE stamp) opens the Mediator dashboard
 *     (`/mediator/$gameId`); a player's (`LaunchDashboard`) opens the player
 *     Dashboard.
 *  2. **The roster** (`GameRoster`): the three columns, yours first.
 *  3. Two columns of sections. **Every member:** Crew & seats and the
 *     proposals awaiting their answer. **The Mediator:** Proposals you sent.
 *     Downtime runs on the Dashboards, not here. **The Organizer:** the
 *     Invite link (copy and reset) and The Game's Hand over, which the
 *     server refuses anyone else (`requireOrganizer`).
 *
 * Starting a Game is "+ New Game" in the band's Games select (`ContainerSwitcher`), and
 * joining one is an invite link (`InviteScreen`), so nothing here is about
 * choosing a table.
 *
 * Connected only: `Roster` mounts this only when the mode is Connected and the
 * active container is a Game, so every hook below has a provider.
 */

import { SHELF } from 'cantina-domain/container'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useShowContainer } from '../entityContainer/useShowContainer'
import { Button, Card, Pending, Skeleton, Text, tokens } from '../index'
import { readCrawler } from '../mediator/crawlerReading.model'
import type { SegmentKind } from '../roster/RosterColumn'
import { CopyInviteLink, ResetInviteLink } from './CopyInviteLink'
import { CrewSeats } from './CrewSeats'
import { DeleteGameDialog } from './DeleteGameDialog'
import { GameBand } from './GameBand'
import { GameRoster } from './GameRoster'
import { HubSection } from './HubSection'
import { GAME_BODY, HUB_COLUMN, HUB_COLUMNS } from './hubStyles.model'
import { LaunchDashboard } from './LaunchDashboard'
import { ProposalInbox } from './ProposalInbox'
import { ProposalsSent } from './ProposalsSent'
import { seatRows } from './seatRows.model'
import { TheGame } from './TheGame'

type Game = NonNullable<FunctionReturnType<typeof api.games.get>>

type GameHubProps = {
  gameId: string
  /** The page's controls, on the band above the Game's name (`Roster`'s). */
  controls?: ReactNode
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

const INVITE_ACTIONS = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[8],
} satisfies CSSProperties

const NOT_IN_CARD = { marginTop: tokens.space[24] } satisfies CSSProperties

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
            You are not in this Game. Ask its Organiser for the invite link, then open it to join.
          </Text>
          <div>
            <Button variant="default" size="compact" onClick={() => showContainer(SHELF)}>
              Back to Hangar
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
  // The seats' HP: the server derives every crewmate's max (ADR-038 §4).
  const vitals = useQuery(api.crew.vitals, { gameId })
  const me = useQuery(api.account.me, {})
  const viewerId = me?._id ?? null

  const primary =
    listing?.crawlers.find((c) => c._id === listing.primaryCrawlerId) ??
    listing?.crawlers[0] ??
    null
  const crawler = primary === null ? null : readCrawler(primary)
  const seats =
    listing === undefined || members === undefined
      ? null
      : seatRows(listing, members, viewerId, vitals)

  return (
    <>
      <div style={HUB_COLUMNS}>
        <div style={HUB_COLUMN}>
          {seats === null ? (
            <Skeleton shape="rows" label="Loading the crew" />
          ) : (
            <CrewSeats
              crawler={crawler}
              rows={seats.rows}
              claimed={seats.claimed}
              total={seats.total}
            />
          )}
          {/* Renders nothing until the Mediator has asked something. */}
          <ProposalInbox gameId={gameId} />
          {/* `proposals.sent` is the Mediator's alone (`requireMediator`). */}
          {game.mediator && <ProposalsSent gameId={gameId} />}
        </div>
        <div style={HUB_COLUMN}>
          {/* The invite URL is administrative, so only the Organizer sees it
              (ADR-030 §3); the server refuses `invites.link` to anyone else. */}
          {game.organizer && (
            <HubSection id="invite-link-heading" title="Invite link">
              <div style={INVITE_ACTIONS}>
                <CopyInviteLink gameId={gameId} />
                <ResetInviteLink gameId={gameId} />
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

export function GameHub({ gameId, controls, activeSegment, onSegmentChange }: GameHubProps) {
  // `games.get` rather than listMine-and-find: it distinguishes "still
  // loading" from "not a member" without fetching every table you are in.
  const game = useQuery(api.games.get, { gameId: gameId as Id<'games'> })

  return (
    <>
      <GameBand
        gameId={gameId}
        name={game ? game.name : 'Game'}
        mediator={game?.mediator}
        controls={controls}
        actions={game && !game.mediator ? <LaunchDashboard gameId={gameId} /> : undefined}
      />
      <div className="su-page-column" style={GAME_BODY}>
        {game === undefined ? (
          <div style={PENDING}>
            <Pending label="this Game" />
          </div>
        ) : game === null ? (
          <NotInGame />
        ) : (
          <>
            <GameRoster
              gameId={gameId}
              gameName={game.name}
              activeSegment={activeSegment}
              onSegmentChange={onSegmentChange}
            />
            <GameSections game={game} />
          </>
        )}
      </div>
    </>
  )
}
