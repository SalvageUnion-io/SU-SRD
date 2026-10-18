/**
 * Play route, the Mediator's — /play/game/:gameId
 *
 * The Mediator's Play screen for one Game, on the same frame as the
 * player's (`PlayMediatorCockpit`). Who may open it, in each storage mode, is
 * `PlayMediatorGate`'s question, asked live in the component, not here:
 * loaders never read player entities (`.claude/rules/tanstack-router.md`),
 * and a Mediator who hands the table over must fall back at once.
 */

import { createFileRoute } from '@tanstack/react-router'
import { pageTitle } from '../../../lib/pageTitle'
import { PlayMediatorGate } from '../../../play/PlayMediatorGate'

export const Route = createFileRoute('/play/game/$gameId')({
  head: () => ({ meta: [{ title: pageTitle('Mediate') }] }),
  component: PlayMediatorPage,
})

function PlayMediatorPage() {
  const { gameId } = Route.useParams()
  return <PlayMediatorGate gameId={gameId} />
}
