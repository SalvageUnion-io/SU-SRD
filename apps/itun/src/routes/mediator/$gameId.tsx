/**
 * Mediator Dashboard route — /mediator/:gameId (issue 1278;
 * docs/architecture/mediator-dashboard.md).
 *
 * The address was kept for exactly this surface: it redirected to the Game
 * page while the Mediator's instruments lived there, and it is the Mediator's
 * own screen again. Who may open it, in each storage mode, is `MediatorGate`'s
 * question, asked live in the component, not here: loaders never read player
 * entities (`.claude/rules/tanstack-router.md`), and a Mediator who hands the
 * table over must fall back at once.
 */

import { createFileRoute } from '@tanstack/react-router'
import { MediatorGate } from '../../components/mediator/MediatorGate'
import { pageTitle } from '../../lib/pageTitle'

export const Route = createFileRoute('/mediator/$gameId')({
  head: () => ({ meta: [{ title: pageTitle('Mediator') }] }),
  component: MediatorPage,
})

function MediatorPage() {
  const { gameId } = Route.useParams()
  return <MediatorGate gameId={gameId} />
}
