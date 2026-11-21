/**
 * Play route, the Mediator's — /games/:gameId/prep
 *
 * A Game's Prep (ADR-067): its encounters in order, its NPCs, its notes and
 * sessions. Who may open it is asked live in the component (`GamePrep` reads
 * `games.get`), not here: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`).
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from '../../../lib/pageTitle'
import { routesCopy } from '../../../messages/routes'
import { GamePrep } from '../../../play/games/prep/GamePrep'

export const Route = createFileRoute('/games/$gameId_/prep')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play, routesCopy('prep')) }] }),
  component: GamePrepPage,
})

function GamePrepPage() {
  const { gameId } = Route.useParams()
  return <GamePrep gameId={gameId} />
}
