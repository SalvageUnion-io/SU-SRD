import { createFileRoute, useParams } from '@tanstack/react-router'

import { GameEntitySheet, GameSheetNotice } from '../components/games/GameEntitySheet'
import type { RosterKind } from '../lib/games/gameRoster'

/**
 * One crewmate's build, read-only (ADR-030 §5).
 *
 * The trailing `_` on BOTH `games_` and `$gameId_` opts this route out of
 * nesting twice over: once from `routes/games.tsx` (the lobby, which renders no
 * `<Outlet />`), and once from `games_.$gameId.tsx` (the crew roster, likewise).
 * Without the second underscore TanStack would treat the crew screen as this
 * route's layout and render the roster above every sheet — or, since it has no
 * Outlet, render nothing at all.
 *
 * Addressed by the Convex row id rather than the local entity id: the viewer
 * has no local copy of a crewmate's build, and the whole point of this surface
 * is that visiting it does not create one.
 */
export const Route = createFileRoute('/games_/$gameId_/view/$kind/$entityId')({
  component: GameEntityViewRoute,
})

/** The three roster ontologies, as the URL is allowed to spell them. */
const KINDS: readonly RosterKind[] = ['pilot', 'mech', 'crawler']

function isRosterKind(value: string): value is RosterKind {
  return (KINDS as readonly string[]).includes(value)
}

function GameEntityViewRoute() {
  const { gameId, kind, entityId } = useParams({ from: '/games_/$gameId_/view/$kind/$entityId' })

  // `kind` comes off the URL and selects a Zod schema downstream, so a
  // hand-typed or stale path is narrowed here rather than cast — it earns an
  // explanation and a way back, not a crash inside the parser.
  if (!isRosterKind(kind)) {
    return (
      <GameSheetNotice gameId={gameId}>
        “{kind}” is not something a game holds. The crew has pilots, mechs and a crawler.
      </GameSheetNotice>
    )
  }

  return <GameEntitySheet gameId={gameId} kind={kind} entityId={entityId} />
}
