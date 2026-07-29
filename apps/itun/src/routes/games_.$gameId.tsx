import { createFileRoute, useParams } from '@tanstack/react-router'

import { GameScreen } from '../components/games/GameScreen'

/**
 * One Game's crew — the shared-container twin of the Roster at `/`.
 *
 * Separate from `/games` (the lobby: start one, join one, list the ones you are
 * in) because a crew roster is a place you work rather than a row in a list,
 * and separate from `/mediator/$gameId` because the Mediator surface adds
 * private instruments on top of this rather than replacing it.
 *
 * The trailing `_` on `games_` opts this route OUT of nesting under
 * `routes/games.tsx`. Without it TanStack treats `/games` as a layout and
 * expects an `<Outlet />` there — which `GamesScreen` does not render, so the
 * crew roster would resolve, match, and display nothing at all.
 */
export const Route = createFileRoute('/games_/$gameId')({
  component: GameRoute,
})

function GameRoute() {
  const { gameId } = useParams({ from: '/games_/$gameId' })
  return <GameScreen gameId={gameId} />
}
