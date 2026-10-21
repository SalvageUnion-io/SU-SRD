/**
 * GameHub — a Game's own page in Play, `/play/games/$gameId` (ADR-052 §5).
 *
 * One place per table, in the Manage context (ruleset §1.9): paper under the
 * `play` band, level 0, Slab sections, Compacts that link. It lists a Game the
 * way the Training Bay lists your things and puts everything you can do about the
 * table below the lists, as board M2 draws it
 * (docs/architecture/play.md §16):
 *
 *  0. **The band** (`GameBand`): the Game's name on Play's band, and one way
 *     into the Cockpit: the Mediator's **Mediate** (after a YOU MEDIATE stamp)
 *     opens Play's Mediator screen (`/play/game/$gameId`); a player's **Play**
 *     (`LaunchPlay`) asks which pilot and opens Play for it.
 *  1. Two columns of sections. **Every member:** the Crew (`GameRoster`):
 *     one list, the crawler first, each pilot's seat (its HP, its mech) on
 *     its row, the head counting them; it links out to Build for anything
 *     about building (owner, round 8: Play only plays). Then the proposals
 *     awaiting their answer. **The Mediator:** Proposals you sent.
 *     Downtime runs in the Cockpit, not here. **The Organiser:** the
 *     Invite link (copy and reset, chips on its head) and The Game's Hand over, which the
 *     server refuses anyone else (`requireOrganizer`).
 *
 * Moving between Games is Play's, and joining one is an invite link
 * (`InviteScreen`), so nothing here is about choosing a table. Nothing here
 * picks a container either: a unit's Game is the unit's (ADR-052 §3).
 *
 * Connected only: `GamePage` mounts this only when the mode is Connected, so
 * every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  Button,
  Callout,
  Grid,
  PageShell,
  Pending,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { CopyInviteLink, ResetInviteLink } from './CopyInviteLink'
import { DeleteGameDialog } from './DeleteGameDialog'
import { GameBand } from './GameBand'
import { GameRoster } from './GameRoster'
import { GAME_BODY, HUB_COLUMN, HUB_COLUMN_MIN, HUB_COLUMNS } from './hubStyles.model'
import { LaunchPlay } from './LaunchPlay'
import { ProposalInbox } from './ProposalInbox'
import { ProposalsSent } from './ProposalsSent'
import { TheGame } from './TheGame'

type Game = NonNullable<FunctionReturnType<typeof api.games.get>>

type GameHubProps = {
  gameId: string
}

const PENDING = { marginTop: tokens.space[24] } satisfies CSSProperties

const NOT_IN_NOTE = { marginTop: tokens.space[24] } satisfies CSSProperties

/** Play's hub, where your Games are listed. */
const PLAY_HUB = '/play/'

/**
 * A Game the viewer is not in: they left, it ended, or an old link points at
 * it. `games.get` answers `null` for all of them alike, deliberately — a
 * non-member must not be able to tell an existing Game from a deleted one.
 * It says so in an unlabelled note (chrome K5), with the way back to Play.
 */
function NotInGame() {
  return (
    <div style={NOT_IN_NOTE}>
      <Callout role="note">
        <Text>
          You are not in this Game. Ask its Organiser for the invite link, then open it to join.
        </Text>
        <div>
          <Button href={PLAY_HUB} back size="compact">
            Play
          </Button>
        </div>
      </Callout>
    </div>
  )
}

/** The page's sections, in board M2's two columns: the crew's, then the table's. */
function GameSections({ game }: { game: Game }) {
  const gameId = game._id as Id<'games'>
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Probed rather than required: component tests render the page without a
  // RouterProvider, and `AppLink` degrades the same way.
  const router = useRouter({ warn: false })
  const me = useQuery(api.account.me, {})
  const viewerId = me?._id ?? null

  return (
    <>
      <Grid min={HUB_COLUMN_MIN} gap={24} style={HUB_COLUMNS}>
        {/* A column with nothing in it takes no row on a phone (`.su-hub-column`). */}
        <div className="su-hub-column" style={HUB_COLUMN}>
          <GameRoster gameId={gameId} gameName={game.name} />
          {/* Renders nothing until the Mediator has asked something. */}
          <ProposalInbox gameId={gameId} />
          {/* `proposals.sent` is the Mediator's alone (`requireMediator`). */}
          {game.mediator && <ProposalsSent gameId={gameId} />}
        </div>
        <div className="su-hub-column" style={HUB_COLUMN}>
          {/* The invite URL is administrative, so only the Organizer sees it
              (ADR-030 §3); the server refuses `invites.link` to anyone else. */}
          {game.organizer && (
            <SlabSection
              as="h2"
              id="invite-link-heading"
              title="Invite link"
              actions={
                <>
                  <CopyInviteLink gameId={gameId} />
                  <ResetInviteLink gameId={gameId} />
                </>
              }
            />
          )}
          <TheGame
            gameId={gameId}
            viewerId={viewerId}
            organizer={game.organizer}
            onDelete={() => setConfirmingDelete(true)}
          />
        </div>
      </Grid>

      <DeleteGameDialog
        game={confirmingDelete ? game : null}
        onClose={() => setConfirmingDelete(false)}
        // Back to your Games BEFORE `games.get` resolves to `null`, which would
        // otherwise show "You are not in this game" — true, and read as an
        // error by someone who just deleted it.
        onDeleted={() => {
          if (router) void router.navigate({ to: '/play' })
          else window.location.assign(PLAY_HUB)
        }}
      />
    </>
  )
}

export function GameHub({ gameId }: GameHubProps) {
  // `games.get` rather than listMine-and-find: it distinguishes "still
  // loading" from "not a member" without fetching every table you are in.
  const game = useQuery(api.games.get, { gameId: gameId as Id<'games'> })

  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <GameBand
          gameId={gameId}
          name={game ? game.name : 'Game'}
          mediator={game?.mediator}
          actions={game && !game.mediator ? <LaunchPlay gameId={gameId} /> : undefined}
        />
      }
      bodyStyle={GAME_BODY}
    >
      {game === undefined ? (
        <div style={PENDING}>
          <Pending label="this Game" />
        </div>
      ) : game === null ? (
        <NotInGame />
      ) : (
        <GameSections game={game} />
      )}
    </PageShell>
  )
}
