/**
 * A Game's page — /play/games/:gameId (ADR-052 §5)
 *
 * The Game's management page in Play: its roster, crew and seats, proposals,
 * the invite link, the Mediator and the Game's settings (`GamePage`). Separate
 * from the Mediator's live Cockpit (`/play/games/:gameId/mediate`); both Cockpits link
 * here from their ⋯. Who may see it is `games.get`'s question, asked live in
 * the component: a Game you are not in reads as an explanation.
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from '../../../lib/pageTitle'
import { GamePage } from '../../../play/games/GamePage'

export const Route = createFileRoute('/play/games/$gameId')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play, 'Game') }] }),
  component: GamePageRoute,
})

function GamePageRoute() {
  const { gameId } = Route.useParams()
  return <GamePage gameId={gameId} />
}
