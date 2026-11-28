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
 *     Invite link (on show, with copy, share and reset). **Every member**
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
import { useEffect, useState } from 'react'
import { PageShell } from '../../components/app'
import { Button, Callout, Pending, SlabSection, Text } from '../../components/index'
import { writeLastGame } from '../../lib/accountHint'
import { PAGE_MEASURE } from '../../lib/pageMeasure'
import { areaTitle } from '../../lib/pageTitle'
import { localStore } from '../../lib/safeLocalStorage'
import { useTabTitle } from '../../lib/useTabTitle'
import { playGamesCopy } from '../../messages/play-games'
import { routesCopy } from '../../messages/routes'
import type { GameCallResult } from '../../replica/roomCalls'
import { useGamesQuery, useViewerId } from '../../replica/roomCalls'
import { useGameSession } from '../useGameSession'
import { sceneConditionNames, useScene } from '../useScene'
import { useStopSign } from '../useStopSign'
import { InviteLink } from './CopyInviteLink'
import { DeleteGameDialog } from './DeleteGameDialog'
import { FormerNotes } from './FormerNotes'
import { GameBand } from './GameBand'
import { GameRoster } from './GameRoster'
import { GameSafety } from './GameSafety'
import { HUB_ACTIONS, HUB_COLUMNS, HUB_MAIN, HUB_SIDEBAR } from './hubStyles.model'
import { LastSession } from './LastSession'
import { LaunchPlay } from './LaunchPlay'
import { MediatorPrep } from './MediatorPrep'
import { ProposalInbox } from './ProposalInbox'
import { ProposalsSent } from './ProposalsSent'
import { TheGame } from './TheGame'
import { useNextSession } from './useNextSession'

type Game = NonNullable<GameCallResult<'games.get'>>

type GameHubProps = {
  gameId: string
}

/** The Stop Sign's banner leads the page: the sections start a block's gap under it. */

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
  const plans = useNextSession(game)

  return (
    // Its crew is one manifest (`GameRoster`).
    <>
      <div style={HUB_COLUMNS}>
        <div style={HUB_MAIN}>
          {/* The crew manifest leads the
              page — what the table is made of — and everything that runs the
              table (its people, the prep, the invite, safety) is the column
              beside it. */}
          {/* An ended session's recap leads the page until the next one starts (r6 C1). */}
          <LastSession gameId={gameId} place="lead" plans={plans} />
          <GameRoster
            gameId={gameId}
            gameName={game.name}
            pregens={game.organizer ? game.templateUnitIds : undefined}
          />
          {/* Renders nothing until the Mediator has asked something. */}
          <ProposalInbox gameId={gameId} />
          {/* `ops.sent` is the Mediator's alone (`requireMediator`). */}
          {game.mediator && <ProposalsSent gameId={gameId} />}
          {/* The table's record, outside Play: nothing until the Game has been played. */}
          <LastSession gameId={gameId} place="after" />
        </div>
        <aside aria-labelledby="the-game-heading" style={HUB_SIDEBAR}>
          <TheGame
            gameId={gameId}
            viewerId={viewerId}
            organizer={game.organizer}
            game={game}
            onDelete={() => setConfirmingDelete(true)}
            onLeft={() => {
              if (router) void router.navigate({ to: '/games' })
            }}
          />
          {/* The table runner's door to this Game's Prep (ADR-067 §3). */}
          {game.tableRunner && <MediatorPrep gameId={gameId} />}
          {/* A former Mediator's own notes, read-only; nothing for anyone who wrote none. */}
          {!game.tableRunner && <FormerNotes gameId={gameId} />}
          {/* The invite URL is administrative, so only the Organizer sees it
              (ADR-030 §3); the server refuses `invites.link` to anyone else. */}
          {game.organizer && (
            // Its buttons are wider than the strip's room beside the title in
            // this column, so they are the section's body, under its title.
            <SlabSection as="h2" id="invite-link-heading" title={playGamesCopy('inviteLink')}>
              <div style={HUB_ACTIONS}>
                <InviteLink gameId={gameId} />
              </div>
            </SlabSection>
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
    </>
  )
}

export function GameHub({ gameId }: GameHubProps) {
  // `games.get` rather than listMine-and-find: it distinguishes "still
  // loading" from "not a member" without fetching every table you are in.
  const game = useGamesQuery('games.get', { gameId: gameId })
  const session = useGameSession(gameId)
  const scene = useScene(gameId)
  useTabTitle(game ? areaTitle(PRODUCT.play, `${game.name} · ${routesCopy('game')}`) : null)
  // The home's welcome-back strip names the Game last opened (`accountHint`).
  const gameName = game?.name
  useEffect(() => {
    if (gameName) writeLastGame({ id: gameId, name: gameName }, localStore())
  }, [gameId, gameName])

  return (
    <PageShell
      measure={PAGE_MEASURE}
      stack={false}
      band={
        <GameBand
          gameId={gameId}
          name={game ? game.name : 'Game'}
          mediator={game?.mediator}
          organizer={game?.organizer === true}
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
          scene={sceneConditionNames(scene.conditions)}
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
