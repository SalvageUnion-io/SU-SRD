/**
 * GameHub — a Game's own page in Play, `/games/$gameId` (ADR-052 §5).
 *
 * One place per table, in the Manage context (ruleset §1.9): paper under the
 * `play` band, level 0, Slab sections, Compacts that link. It lists a Game the
 * way the Training Bay lists your things and puts everything you can do about the
 * table below the lists (docs/architecture/play.md §16):
 *
 *  0. **The band** (`GameBand`): the Game's name on Play's band, and the ways
 *     into the Cockpit: the Mediator's **Mediate** (after a YOU MEDIATE stamp)
 *     opens Play's Mediator screen (`/games/$gameId/mediate`); **Play**
 *     (`LaunchPlay`) asks which pilot and opens Play for it, for a player and
 *     for a Mediator who also plays one here.
 *  1. A main column of sections. **Every member:** the Crew (`GameRoster`):
 *     one list, the crawler first, each pilot's seat (its HP, its mech) on
 *     its row, the head counting them; it links out to Build for anything
 *     about building (ADR-052 §3: Play only plays). Then the proposals
 *     awaiting their answer. **The Mediator:** Proposals you sent, then
 *     Your prep (`MediatorPrep`): what the Training Bay keeps ready, and the
 *     way there.
 *     Downtime runs in the Cockpit, not here. **The Organiser:** the
 *     Invite link (copy and reset, chips on its head). **Every member**
 *     again: Safety (`GameSafety`: the Stop Sign, whose banner heads the
 *     page while it is up).
 *  2. A small sidebar: The Game (`TheGame`), the table's people as small
 *     cards, with the Organiser's Hand over, which the server refuses anyone
 *     else (`requireOrganizer`). On a phone it drops below the main column.
 *
 * Moving between Games is Play's, and joining one is an invite link
 * (`InviteScreen`), so nothing here is about choosing a table. Nothing here
 * picks a container either: a unit's Game is the unit's (ADR-052 §3).
 *
 * Connected only: `GamePage` mounts this only when the mode is Connected, so
 * every hook below has a provider.
 */

import { useRouter } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  Button,
  Callout,
  PageShell,
  Pending,
  SlabLookProvider,
  SlabSection,
  Text,
  tokens,
} from '../../components/index'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { areaTitle } from '../../lib/pageTitle'
import { useTabTitle } from '../../lib/useTabTitle'
import { playGamesCopy } from '../../messages/play-games'
import { routesCopy } from '../../messages/routes'
import type { GameCallResult } from '../../replica/roomCalls'
import { useGamesQuery, useViewerId } from '../../replica/roomCalls'
import { StopSignBanner } from '../StopSign'
import { useGameSession } from '../useGameSession'
import { useStopSign } from '../useStopSign'
import { CopyInviteLink, ResetInviteLink } from './CopyInviteLink'
import { DeleteGameDialog } from './DeleteGameDialog'
import { GameBand } from './GameBand'
import { GameRoster } from './GameRoster'
import { GameSafety } from './GameSafety'
import { HUB_COLUMNS, HUB_MAIN, HUB_SIDEBAR } from './hubStyles.model'
import { LaunchPlay } from './LaunchPlay'
import { MediatorPrep } from './MediatorPrep'
import { ProposalInbox } from './ProposalInbox'
import { ProposalsSent } from './ProposalsSent'
import { TheGame } from './TheGame'

type Game = NonNullable<GameCallResult<'games.get'>>

type GameHubProps = {
  gameId: string
}

/** The Stop Sign's banner leads the page: the sections start a block's gap under it. */
const STOP_BANNER = { marginBottom: tokens.space[24] } satisfies CSSProperties

/** Play's hub, where your Games are listed. */
const PLAY_HUB = '/games/'

/**
 * A Game the viewer is not in: they left, it ended, or an old link points at
 * it. `games.get` answers `null` for all of them alike, deliberately — a
 * non-member must not be able to tell an existing Game from a deleted one.
 * It says so in an unlabelled note (chrome K5), with the way back to Play.
 */
function NotInGame() {
  return (
    <Callout role="note">
      <Text>{playGamesCopy('youAreNotInThis')}</Text>
      <div>
        <Button href={PLAY_HUB} back size="compact">
          {playGamesCopy('play')}
        </Button>
      </div>
    </Callout>
  )
}

/** The page's sections in the main column, and the table's people in a small sidebar. */
function GameSections({ game }: { game: Game }) {
  const gameId = game._id
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Probed rather than required: component tests render the page without a
  // RouterProvider, and `AppLink` degrades the same way.
  const router = useRouter({ warn: false })
  const viewerId = useViewerId()
  const sign = useStopSign(gameId)

  return (
    // The Game page reads as a sheet
    // dashboard — its section heads are labels on rules, and its crew is one
    // manifest (`GameRoster`).
    <SlabLookProvider value="rule">
      {sign?.shown && (
        <div style={STOP_BANNER}>
          <StopSignBanner sign={sign} />
        </div>
      )}
      <div style={HUB_COLUMNS}>
        <div style={HUB_MAIN}>
          {/* The crew manifest leads the
              page — what the table is made of — and everything that runs the
              table (its people, the prep, the invite, safety) is the column
              beside it. */}
          <GameRoster gameId={gameId} gameName={game.name} />
          {/* Renders nothing until the Mediator has asked something. */}
          <ProposalInbox gameId={gameId} />
          {/* `ops.sent` is the Mediator's alone (`requireMediator`). */}
          {game.mediator && <ProposalsSent gameId={gameId} />}
        </div>
        <aside aria-labelledby="the-game-heading" style={HUB_SIDEBAR}>
          <TheGame
            gameId={gameId}
            viewerId={viewerId}
            organizer={game.organizer}
            onDelete={() => setConfirmingDelete(true)}
          />
          {/* The Mediator's door to the prep the Training Bay keeps (ADR-066). */}
          {game.mediator && <MediatorPrep />}
          {/* The invite URL is administrative, so only the Organizer sees it
              (ADR-030 §3); the server refuses `invites.link` to anyone else. */}
          {game.organizer && (
            <SlabSection
              as="h2"
              id="invite-link-heading"
              title={playGamesCopy('inviteLink')}
              actions={
                <>
                  <CopyInviteLink gameId={gameId} />
                  <ResetInviteLink gameId={gameId} />
                </>
              }
            />
          )}
          {/* Safety runs last, so the two columns end together. */}
          <GameSafety sign={sign} />
        </aside>
      </div>

      <DeleteGameDialog
        game={confirmingDelete ? game : null}
        onClose={() => setConfirmingDelete(false)}
        // Back to your Games BEFORE `games.get` resolves to `null`, which would
        // otherwise show "You are not in this game" — true, and read as an
        // error by someone who just deleted it.
        onDeleted={() => {
          if (router) void router.navigate({ to: '/games' })
          else window.location.assign(PLAY_HUB)
        }}
      />
    </SlabLookProvider>
  )
}

export function GameHub({ gameId }: GameHubProps) {
  // `games.get` rather than listMine-and-find: it distinguishes "still
  // loading" from "not a member" without fetching every table you are in.
  const game = useGamesQuery('games.get', { gameId: gameId })
  const session = useGameSession(gameId)
  useTabTitle(game ? areaTitle(PRODUCT.play, `${game.name} · ${routesCopy('game')}`) : null)

  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <GameBand
          gameId={gameId}
          name={game ? game.name : 'Game'}
          mediator={game?.mediator}
          actions={
            game ? (
              <LaunchPlay
                gameId={gameId}
                onlyWithPilots={game.mediator}
                live={session?.live === true}
                // A player's door is Play; the Mediator's is Mediate.
                door={!game.mediator}
              />
            ) : undefined
          }
          session={session}
        />
      }
    >
      {game === undefined ? (
        <Pending label={playGamesCopy('thisGame')} />
      ) : game === null ? (
        <NotInGame />
      ) : (
        <GameSections game={game} />
      )}
    </PageShell>
  )
}
