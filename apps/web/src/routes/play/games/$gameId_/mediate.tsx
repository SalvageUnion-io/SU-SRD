/**
 * Play route, the Mediator's — /play/games/:gameId/mediate
 *
 * The Mediator's Play screen for one Game, on the same frame as the
 * player's (`PlayMediatorCockpit`). Who may open it, in each storage mode, is
 * `PlayMediatorGate`'s question, asked live in the component, not here:
 * loaders never read player entities (`.claude/rules/tanstack-router.md`),
 * and a Mediator who hands the table over must fall back at once.
 */

import { createFileRoute } from '@tanstack/react-router'
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from '../../../../lib/pageTitle'
import { routesCopy } from '../../../../messages/routes'
import { PlayMediatorGate } from '../../../../play/PlayMediatorGate'

export const Route = createFileRoute('/play/games/$gameId_/mediate')({
  head: () => ({ meta: [{ title: areaTitle(PRODUCT.play, routesCopy('mediate')) }] }),
  component: PlayMediatorPage,
})

function PlayMediatorPage() {
  const { gameId } = Route.useParams()
  return <PlayMediatorGate gameId={gameId} />
}
